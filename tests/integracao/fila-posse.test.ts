import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { conectarVerificado } from '@/src/server/db/pool'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

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

function assumir(usuarioId: string, empresaId: string): Promise<string> {
  return banco.comoUsuario(usuarioId, async (e) => {
    const r = await e<{ empresa_assumir: string }>('SELECT empresa_assumir($1)', [empresaId])
    return r.linhas[0].empresa_assumir
  })
}

describe('empresa_assumir: a ordem das checagens', () => {
  test('empresa sem linha de fila e nao_encontrada, nao 42501', async () => {
    const id = await criarEmpresa()
    expect(await assumir(vendedorA, id)).toBe('nao_encontrada')
  })

  test('quem ja e dono recebe ja_e_sua, e nao sem-permissao', async () => {
    const id = await criarEmpresa()
    await banco.sql(
      'INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em) VALUES ($1, $2, now())',
      [id, vendedorA],
    )
    // O CHECK empresa_fila_posse_ou_reserva garante que quem tem posse tem
    // `reservado_por` nulo. Se a checagem de reserva viesse antes desta, o
    // dono cairia em "nenhuma reserva" e receberia 42501 na PRÓPRIA empresa.
    expect(await assumir(vendedorA, id)).toBe('ja_e_sua')
  })

  test('reserva propria expirada e reserva_expirada, texto e nao 42501', async () => {
    const id = await criarEmpresa()
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
       VALUES ($1, $2, now() - interval '1 minute', now())`,
      [id, vendedorA],
    )
    expect(await assumir(vendedorA, id)).toBe('reserva_expirada')
  })

  test('reserva de outra pessoa e 42501', async () => {
    const id = await criarEmpresa()
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
       VALUES ($1, $2, now() + interval '30 minutes', now())`,
      [id, vendedorB],
    )
    await expect(assumir(vendedorA, id)).rejects.toMatchObject({ code: '42501' })
  })

  test('linha sem reserva e sem dono e 42501', async () => {
    const id = await criarEmpresa()
    await banco.sql('INSERT INTO empresa_fila (empresa_id, primeira_reserva_em) VALUES ($1, now())', [id])
    await expect(assumir(vendedorA, id)).rejects.toMatchObject({ code: '42501' })
  })

  test('reserva propria vigente vira posse sem prazo', async () => {
    const id = await criarEmpresa()
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    expect(await assumir(vendedorA, id)).toBe('ok')
    const [estado] = await banco.sql<{ vendedor_id: string; reservado_por: null; reservado_ate: null }>(
      'SELECT vendedor_id, reservado_por, reservado_ate FROM empresa_fila WHERE empresa_id = $1',
      [id],
    )
    expect(estado).toEqual({ vendedor_id: vendedorA, reservado_por: null, reservado_ate: null })
  })

  test('senha provisoria pendente e 42501', async () => {
    const id = await criarEmpresa()
    const pendente = await criarUsuario(banco, 'vendedor', 'PendenteAssumir')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [pendente])
    await expect(assumir(pendente, id)).rejects.toMatchObject({ code: '42501' })
  })
})

// A correção do TOCTOU. Sem o `PERFORM ... FOR UPDATE` nas duas pontas, as
// duas funções decidem sobre leitura velha (`now()` é o início da transação) e
// a posse recém-tomada desaparece em silêncio. Sem este teste, o PERFORM
// parece linha decorativa e o próximo a mexer o remove.
describe('empresa_assumir x fila_puxar: a trava', () => {
  test('assumir segurando a trava faz o fila_puxar concorrente PULAR a empresa', async () => {
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
      await c1.query('SELECT empresa_assumir($1)', [unica])
      await c2.query('BEGIN')
      await c2.query("SELECT set_config('role', 'app_usuario', true)")
      await c2.query("SELECT set_config('app.usuario_id', $1, true)", [vendedorB])
      const puxada = await c2.query('SELECT empresa_id FROM fila_puxar()')
      await c1.query('COMMIT')
      await c2.query('COMMIT')
      // A única empresa da base está travada: SKIP LOCKED pula e não há outra.
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

  test('fila_puxar segurando a trava faz o assumir concorrente esperar e recusar', async () => {
    const unica = await criarEmpresa('0181')
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
       VALUES ($1, $2, now() - interval '1 second', now())`,
      [unica, vendedorA],
    )
    const c1 = await conectarVerificado(banco.urlApp)
    const c2 = await conectarVerificado(banco.urlApp)
    try {
      await c1.query('BEGIN')
      await c1.query("SELECT set_config('role', 'app_usuario', true)")
      await c1.query("SELECT set_config('app.usuario_id', $1, true)", [vendedorB])
      await c1.query('SELECT empresa_id FROM fila_puxar()')
      await c2.query('BEGIN')
      await c2.query("SELECT set_config('role', 'app_usuario', true)")
      await c2.query("SELECT set_config('app.usuario_id', $1, true)", [vendedorA])
      // Espera a trava de c1. Só depois do COMMIT ele relê e vê a reserva de B.
      const espera = c2.query('SELECT empresa_assumir($1)', [unica])
      await c1.query('COMMIT')
      await expect(espera).rejects.toMatchObject({ code: '42501' })
      await c2.query('ROLLBACK')
      const [estado] = await banco.sql<{ vendedor_id: string | null; reservado_por: string }>(
        'SELECT vendedor_id, reservado_por FROM empresa_fila WHERE empresa_id = $1',
        [unica],
      )
      // Quem tem a empresa é quem puxou, e não existe posse nenhuma.
      expect(estado).toEqual({ vendedor_id: null, reservado_por: vendedorB })
    } finally {
      c1.release()
      c2.release()
    }
  })
})

function devolver(usuarioId: string, empresaId: string): Promise<string> {
  return banco.comoUsuario(usuarioId, async (e) => {
    const r = await e<{ empresa_devolver: string }>('SELECT empresa_devolver($1)', [empresaId])
    return r.linhas[0].empresa_devolver
  })
}

describe('empresa_devolver', () => {
  test('devolve posse, limpa tudo e grava o piso', async () => {
    const id = await criarEmpresa('0181')
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    await assumir(vendedorA, id)
    expect(await devolver(vendedorA, id)).toBe('ok')
    const [estado] = await banco.sql<{
      vendedor_id: null
      reservado_por: null
      reservado_ate: null
      dias: string
    }>(
      `SELECT vendedor_id, reservado_por, reservado_ate,
              round(extract(epoch FROM elegivel_em - now()) / 86400)::text AS dias
         FROM empresa_fila WHERE empresa_id = $1`,
      [id],
    )
    expect(estado.vendedor_id).toBeNull()
    expect(estado.reservado_por).toBeNull()
    expect(estado.reservado_ate).toBeNull()
    // O prazo é do banco; o teste confere que o piso existe e é de 30 dias
    // sem escrever o número em nenhuma constante de TypeScript.
    expect(estado.dias).toBe('30')
  })

  test('devolve reserva vigente, sem ter assumido', async () => {
    const id = await criarEmpresa('0181')
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    expect(await devolver(vendedorA, id)).toBe('ok')
  })

  test('devolvida nao volta a ser puxavel na hora', async () => {
    const id = await criarEmpresa('0181')
    await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    await devolver(vendedorA, id)
    const r = await banco.comoUsuario(vendedorB, (e) => e('SELECT empresa_id FROM fila_puxar()'))
    expect(r.linhas).toEqual([])
  })

  test('empresa sem linha de fila e nao_encontrada', async () => {
    const id = await criarEmpresa('0181')
    expect(await devolver(vendedorA, id)).toBe('nao_encontrada')
  })

  test('empresa de outro vendedor e 42501', async () => {
    const id = await criarEmpresa('0181')
    await banco.sql(
      'INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em) VALUES ($1, $2, now())',
      [id, vendedorB],
    )
    await expect(devolver(vendedorA, id)).rejects.toMatchObject({ code: '42501' })
  })

  // O CASO DO COALESCE, e ele é o motivo de o COALESCE existir.
  //
  // Linha sem dono e sem reserva: `v_dono` e `v_resv` são nulos, então
  // `v_dono = v_eu OR v_resv = v_eu` é NULL — não false. `NOT NULL` é NULL, e
  // `IF NULL THEN` NÃO EXECUTA: sem o default explícito, a checagem de posse
  // seria PULADA e qualquer vendedor devolveria empresa de qualquer outro.
  test('linha sem dono e sem reserva e 42501, nao passa direto', async () => {
    const id = await criarEmpresa('0181')
    await banco.sql('INSERT INTO empresa_fila (empresa_id, primeira_reserva_em) VALUES ($1, now())', [id])
    await expect(devolver(vendedorA, id)).rejects.toMatchObject({ code: '42501' })
  })

  test('gestor NAO devolve empresa alheia nesta fatia', async () => {
    const gestor = await criarUsuario(banco, 'gestor', 'GestorDevolve')
    const id = await criarEmpresa('0181')
    await banco.sql(
      'INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em) VALUES ($1, $2, now())',
      [id, vendedorA],
    )
    // Tirar posse é do gestor e foi adiado. Se um dia isto passar a devolver
    // 'ok', a operação chegou sem tela — superfície sem consumidor (R-014).
    await expect(devolver(gestor, id)).rejects.toMatchObject({ code: '42501' })
  })

  test('senha provisoria pendente e 42501', async () => {
    const id = await criarEmpresa('0181')
    const pendente = await criarUsuario(banco, 'vendedor', 'PendenteDevolve')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [pendente])
    await banco.sql(
      'INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em) VALUES ($1, $2, now())',
      [id, pendente],
    )
    await expect(devolver(pendente, id)).rejects.toMatchObject({ code: '42501' })
  })
})
