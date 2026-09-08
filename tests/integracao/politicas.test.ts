import { afterAll, beforeAll, describe, expect, test } from 'vitest'
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
})

describe('controle negativo', () => {
  test('como dono, RLS é ignorada e todos aparecem', async () => {
    const r = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM usuario')
    expect(r[0].n).toBeGreaterThan(3)
  })
})
