import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { chamar } from '@/src/server/db/sem-identidade'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outroVendedor: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestora')
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  outroVendedor = await criarUsuario(banco, 'vendedor', 'Outro')
})
afterAll(async () => {
  await banco.derrubar()
})

const inserir = (nome: string, email: string, papel: string) =>
  `INSERT INTO usuario (nome, email, papel) VALUES ('${nome}', '${email}', '${papel}')`

describe('INSERT', () => {
  test('vendedor não insere: erro 42501', async () => {
    await expect(
      banco.comoUsuario(vendedor, (e) => e(inserir('X', 'x@teste.local', 'vendedor'))),
    ).rejects.toMatchObject({ code: '42501' })
  })

  test('gestor insere', async () => {
    const r = await banco.comoUsuario(gestor, (e) => e(inserir('Nova', 'nova@teste.local', 'vendedor')))
    expect(r.afetadas).toBe(1)
  })

  test('vendedor não se promove nem cria gestor', async () => {
    await expect(
      banco.comoUsuario(vendedor, (e) => e(inserir('Eu', 'eu@teste.local', 'gestor'))),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('UPDATE', () => {
  test('gestor altera outro usuário', async () => {
    const r = await banco.comoUsuario(gestor, (e) => e("UPDATE usuario SET nome = 'Renomeado' WHERE id = $1", [vendedor]))
    expect(r.afetadas).toBe(1)
  })

  test('gestor não altera a si mesmo: linha invisível, afetadas 0, sem erro', async () => {
    const r = await banco.comoUsuario(gestor, (e) => e("UPDATE usuario SET nome = 'Eu' WHERE id = $1", [gestor]))
    expect(r.afetadas).toBe(0)
    const [{ nome }] = await banco.sql<{ nome: string }>('SELECT nome FROM usuario WHERE id = $1', [gestor])
    expect(nome).toBe('Gestora')
  })

  test('vendedor não altera ninguém, nem a si: afetadas 0', async () => {
    const proprio = await banco.comoUsuario(vendedor, (e) =>
      e("UPDATE usuario SET nome = 'Hack' WHERE id = $1", [vendedor]),
    )
    expect(proprio.afetadas).toBe(0)
    const outro = await banco.comoUsuario(vendedor, (e) =>
      e("UPDATE usuario SET papel = 'gestor' WHERE id = $1", [outroVendedor]),
    )
    expect(outro.afetadas).toBe(0)
  })

  test('gestor desativa outro (controle: a política de alterar funciona quando deve)', async () => {
    const r = await banco.comoUsuario(gestor, (e) => e('UPDATE usuario SET ativo = false WHERE id = $1', [outroVendedor]))
    expect(r.afetadas).toBe(1)
    await banco.sql('UPDATE usuario SET ativo = true WHERE id = $1', [outroVendedor])
  })
})

describe('DELETE', () => {
  test('ninguém apaga, nem gestor: 42501 por falta de GRANT', async () => {
    await expect(
      banco.comoUsuario(gestor, (e) => e('DELETE FROM usuario WHERE id = $1', [vendedor])),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('desativação tem efeito imediato', () => {
  test('usuário desativado não lê nem a si mesmo', async () => {
    const id = await criarUsuario(banco, 'vendedor', 'Desativado')
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [id])
    const r = await banco.comoUsuario(id, (e) => e('SELECT id FROM usuario'))
    expect(r.afetadas).toBe(0)
  })

  test('gestor desativado não é mais gestor', async () => {
    const id = await criarUsuario(banco, 'gestor', 'ExGestor')
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [id])
    const r = await banco.comoUsuario(id, (e) => e('SELECT id FROM usuario'))
    expect(r.afetadas).toBe(0)
  })
})

describe('senha provisória pendente', () => {
  test('gestor pendente lê normalmente e não insere nem altera: barreira do banco', async () => {
    const id = await criarUsuario(banco, 'gestor', 'Pendente')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [id])
    const le = await banco.comoUsuario(id, (e) => e('SELECT id FROM usuario'))
    expect(le.afetadas).toBeGreaterThan(1)
    await expect(
      banco.comoUsuario(id, (e) => e(inserir('P', 'p@teste.local', 'vendedor'))),
    ).rejects.toMatchObject({ code: '42501' })
    const altera = await banco.comoUsuario(id, (e) => e("UPDATE usuario SET nome = 'X' WHERE id = $1", [vendedor]))
    expect(altera.afetadas).toBe(0)
  })

  test('marca congelada: gestor não zera a senha_provisoria_pendente de outro (42501), mas altera o resto da linha', async () => {
    const id = await criarUsuario(banco, 'vendedor', 'Marcado')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [id])
    await expect(
      banco.comoUsuario(gestor, (e) => e('UPDATE usuario SET senha_provisoria_pendente = false WHERE id = $1', [id])),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      banco.comoUsuario(gestor, (e) => e('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [vendedor])),
    ).rejects.toMatchObject({ code: '42501' })
    const nome = await banco.comoUsuario(gestor, (e) => e("UPDATE usuario SET nome = 'Marcado2' WHERE id = $1", [id]))
    expect(nome.afetadas).toBe(1)
    const [l] = await banco.sql<{ p: boolean }>('SELECT senha_provisoria_pendente AS p FROM usuario WHERE id = $1', [id])
    expect(l.p).toBe(true)
  })

  test('transição do primeiro acesso: depois de senha_trocar, o mesmo gestor volta a escrever sem nova sessão', async () => {
    const id = await criarUsuario(banco, 'gestor', 'Primeiro')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [id])
    await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [id, 'provisoria'])
    await chamar('sessao_criar', [id, 'h-primeiro', new Date(Date.now() + 60_000)])
    await expect(
      banco.comoUsuario(id, (e) => e(inserir('Antes', 'antes@teste.local', 'vendedor'))),
    ).rejects.toMatchObject({ code: '42501' })
    await chamar('senha_trocar', ['h-primeiro', 'definitiva'])
    const depois = await banco.comoUsuario(id, (e) => e(inserir('Depois', 'depois@teste.local', 'vendedor')))
    expect(depois.afetadas).toBe(1)
    const altera = await banco.comoUsuario(id, (e) => e("UPDATE usuario SET nome = 'Alterado' WHERE id = $1", [vendedor]))
    expect(altera.afetadas).toBe(1)
  })
})

describe('isenção de dono', () => {
  // A autoridade de usuario_situacao_definir depende desta suposição: dentro
  // de uma definidora, a política de usuario não é avaliada, porque a dona é
  // isenta de RLS. A isenção vem por DOIS caminhos independentes, e hoje os
  // dois valem: a dona é superusuária, e é dona da tabela sem FORCE.
  //
  // Verificado em 2026-09-09: com dona superusuária, ligar FORCE sozinho NÃO
  // muda este resultado, porque superusuário ignora RLS sempre. FORCE remove
  // só a isenção de dono. Então este teste fica vermelho apenas quando os
  // dois caminhos caem juntos: dona vira papel comum E FORCE ligado, que é o
  // cenário de bloqueio geral de docs/db/0010.md. Ou se a função deixar de
  // ser SECURITY DEFINER.
  //
  // É menos sensível do que parece à primeira vista, e está aqui assim
  // mesmo: prende a suposição em vez de deixá-la só na prosa.
  test('definidora lê linha que a política esconde do chamador', async () => {
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [gestor])
    try {
      const direto = await banco.comoUsuario(vendedor, (e) =>
        e('SELECT senha_provisoria_pendente FROM usuario WHERE id = $1', [gestor]),
      )
      expect(direto.afetadas).toBe(0)
      const pelaDefinidora = await banco.comoUsuario(vendedor, (e) =>
        e<{ senha_provisoria_de: boolean | null }>('SELECT senha_provisoria_de($1)', [gestor]),
      )
      expect(pelaDefinidora.linhas[0].senha_provisoria_de).toBe(true)
    } finally {
      await banco.sql('UPDATE usuario SET senha_provisoria_pendente = false WHERE id = $1', [gestor])
    }
  })
})

describe('controle negativo', () => {
  test('como dono, RLS é ignorada e todos aparecem', async () => {
    const r = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM usuario')
    expect(r[0].n).toBeGreaterThan(3)
  })
})
