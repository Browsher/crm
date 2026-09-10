import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { conectarVerificado } from '@/src/server/db/pool'
import { criarBancoDeTeste, criarUsuario, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedorA: string
let vendedorB: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedorA = await criarUsuario(banco, 'vendedor', 'VendedorA')
  vendedorB = await criarUsuario(banco, 'vendedor', 'VendedorB')
})
afterAll(async () => {
  await banco.derrubar()
})

beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
})

async function criarEmpresa(sufixo = '0181'): Promise<string> {
  const [linha] = await banco.sql<{ id: string }>(
    `INSERT INTO empresa (cnpj, razao_social, telefone)
     VALUES ($1, $2, '11987654321') RETURNING id`,
    [`1122233300${sufixo}`, `Empresa ${sufixo}`],
  )
  return linha.id
}

type Args = {
  tipo?: string
  nota?: string | null
  proximoPasso?: string | null
  proximoPassoData?: string | null
  desfecho?: string
}

function registrar(usuarioId: string, empresaId: string, args: Args = {}): Promise<string> {
  return banco.comoUsuario(usuarioId, async (e) => {
    const r = await e<{ contato_registrar: string }>('SELECT contato_registrar($1, $2, $3, $4, $5, $6)', [
      empresaId,
      args.tipo ?? 'nao_atendeu',
      args.nota ?? null,
      args.proximoPasso ?? null,
      args.proximoPassoData ?? null,
      args.desfecho ?? 'nenhum',
    ])
    return r.linhas[0].contato_registrar
  })
}

function contarContatos(): Promise<number> {
  return banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM contato').then(([l]) => Number(l.n))
}

describe('contato_registrar: quem pode', () => {
  test('empresa sem linha de fila e nao_encontrada', async () => {
    const id = await criarEmpresa()
    expect(await registrar(vendedorA, id)).toBe('nao_encontrada')
  })

  test('empresa que nao esta com voce e 42501', async () => {
    const id = await criarEmpresa()
    await banco.comoUsuario(vendedorB, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    await expect(registrar(vendedorA, id)).rejects.toMatchObject({ code: '42501' })
  })

  test('reserva propria expirada e reserva_expirada, e NAO deixa contato', async () => {
    const id = await criarEmpresa()
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
       VALUES ($1, $2, now() - interval '1 minute', now())`,
      [id, vendedorA],
    )
    expect(await registrar(vendedorA, id)).toBe('reserva_expirada')
    expect(await contarContatos()).toBe(0)
  })

  test('senha provisoria pendente e 42501', async () => {
    const id = await criarEmpresa()
    const pendente = await criarUsuarioComSenha(banco, 'vendedor', 'Pendente', 'segredo123', { pendente: true })
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
       VALUES ($1, $2, now() + interval '30 minutes', now())`,
      [id, pendente.id],
    )
    await expect(registrar(pendente.id, id)).rejects.toMatchObject({ code: '42501' })
  })

  // Desfecho inventado é a aplicação passando lixo, não pergunta legítima
  // recusada: não é 42501 e não entra no vocabulário.
  test('desfecho fora do vocabulario LANCA, e nao vira 42501', async () => {
    const id = await criarEmpresa()
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    const erro = await registrar(vendedorA, id, { desfecho: 'talvez' }).catch((e: { code?: string }) => e)
    expect(erro).toBeInstanceOf(Error)
    expect((erro as { code?: string }).code).not.toBe('42501')
  })
})

describe('contato_registrar: os três desfechos', () => {
  test('nenhum grava o contato e nao mexe na fila', async () => {
    const id = await criarEmpresa()
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    expect(await registrar(vendedorA, id, { desfecho: 'nenhum' })).toBe('ok')
    const [f] = await banco.sql<{ vendedor_id: string | null; reservado_por: string | null }>(
      'SELECT vendedor_id, reservado_por FROM empresa_fila WHERE empresa_id = $1',
      [id],
    )
    expect(f).toEqual({ vendedor_id: null, reservado_por: vendedorA })
    expect(await contarContatos()).toBe(1)
  })

  test('assumir grava posse E o contato', async () => {
    const id = await criarEmpresa()
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    expect(await registrar(vendedorA, id, { tipo: 'interessado', desfecho: 'assumir' })).toBe('ok')
    const [f] = await banco.sql<{ vendedor_id: string | null }>(
      'SELECT vendedor_id FROM empresa_fila WHERE empresa_id = $1',
      [id],
    )
    expect(f.vendedor_id).toBe(vendedorA)
    expect(await contarContatos()).toBe(1)
  })

  test('devolver grava o piso E o contato', async () => {
    const id = await criarEmpresa()
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    expect(await registrar(vendedorA, id, { desfecho: 'devolver' })).toBe('ok')
    const [f] = await banco.sql<{ vendedor_id: string | null; elegivel_em: Date | null }>(
      'SELECT vendedor_id, elegivel_em FROM empresa_fila WHERE empresa_id = $1',
      [id],
    )
    expect(f.vendedor_id).toBeNull()
    expect(f.elegivel_em).toBeInstanceOf(Date)
    expect(await contarContatos()).toBe(1)
  })

  test('ja_e_sua vem propagado de empresa_assumir, e nao deixa contato', async () => {
    const id = await criarEmpresa()
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    await registrar(vendedorA, id, { tipo: 'interessado', desfecho: 'assumir' })
    await banco.sql('DELETE FROM contato')
    expect(await registrar(vendedorA, id, { tipo: 'interessado', desfecho: 'assumir' })).toBe('ja_e_sua')
    expect(await contarContatos()).toBe(0)
  })
})

// O passo 5 antes do passo 6 do contrato. Sem este teste, a ordem parece
// arbitrária e o próximo a mexer insere o contato primeiro — e aí um desfecho
// que falha deixa contato órfão, porque RETURN não desfaz INSERT em plpgsql.
describe('contato_registrar: desfecho que falha nao deixa contato', () => {
  test('reserva expirada com desfecho assumir devolve reserva_expirada e zero contatos', async () => {
    const id = await criarEmpresa()
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
       VALUES ($1, $2, now() - interval '1 second', now())`,
      [id, vendedorA],
    )
    expect(await registrar(vendedorA, id, { tipo: 'interessado', desfecho: 'assumir' })).toBe('reserva_expirada')
    expect(await contarContatos()).toBe(0)
  })
})

describe('contato_registrar: o conteudo gravado', () => {
  test('grava tipo, nota, passo e data como vieram, e criado_por e quem chamou', async () => {
    const id = await criarEmpresa()
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    await registrar(vendedorA, id, {
      tipo: 'retornar_depois',
      nota: 'pediu para ligar em marco',
      proximoPasso: 'Retomar contato',
      proximoPassoData: '2027-03-02',
      desfecho: 'devolver',
    })
    const [c] = await banco.sql<{
      tipo: string
      nota: string
      proximo_passo: string
      criado_por: string
    }>('SELECT tipo, nota, proximo_passo, criado_por FROM contato')
    expect(c.tipo).toBe('retornar_depois')
    expect(c.nota).toBe('pediu para ligar em marco')
    expect(c.proximo_passo).toBe('Retomar contato')
    expect(c.criado_por).toBe(vendedorA)
  })
})

// A trava. `contato_registrar` escreve em `empresa_fila` pelo desfecho, então
// vale para ela a mesma regra das três funções da 0016.
describe('contato_registrar x fila_puxar: a trava', () => {
  test('contato_registrar segurando a trava faz o fila_puxar concorrente PULAR a empresa', async () => {
    const unica = await criarEmpresa('0181')
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
       VALUES ($1, $2, now() + interval '30 minutes', now())`,
      [unica, vendedorA],
    )
    const c1 = await conectarVerificado(banco.urlApp)
    const c2 = await conectarVerificado(banco.urlApp)
    try {
      await c1.query('BEGIN')
      await c1.query("SELECT set_config('role', 'app_usuario', true)")
      await c1.query("SELECT set_config('app.usuario_id', $1, true)", [vendedorA])
      await c1.query('SELECT contato_registrar($1, $2, NULL, NULL, NULL, $3)', [unica, 'interessado', 'assumir'])
      await c2.query('BEGIN')
      await c2.query("SELECT set_config('role', 'app_usuario', true)")
      await c2.query("SELECT set_config('app.usuario_id', $1, true)", [vendedorB])
      const puxada = await c2.query('SELECT empresa_id FROM fila_puxar()')
      await c1.query('COMMIT')
      await c2.query('COMMIT')
      expect(puxada.rows).toEqual([])
      const [estado] = await banco.sql<{ vendedor_id: string }>(
        'SELECT vendedor_id FROM empresa_fila WHERE empresa_id = $1',
        [unica],
      )
      expect(estado.vendedor_id).toBe(vendedorA)
    } finally {
      c1.release()
      c2.release()
    }
  })
})
