import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let outroGestor: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestora')
  outroGestor = await criarUsuario(banco, 'gestor', 'Gestor2')
})
afterAll(async () => {
  await banco.derrubar()
})

type Linha = { criado_por: string | null; atualizado_por: string | null; criado_em: Date; atualizado_em: Date | null }
const ler = (email: string) =>
  banco.sql<Linha>('SELECT criado_por, atualizado_por, criado_em, atualizado_em FROM usuario WHERE email = $1', [email])

describe('INSERT', () => {
  test('criado_por vem da identidade, atualizado_* nulos', async () => {
    await banco.comoUsuario(gestor, (e) =>
      e("INSERT INTO usuario (nome, email, papel) VALUES ('N', 'n@teste.local', 'vendedor')"),
    )
    const [l] = await ler('n@teste.local')
    expect(l.criado_por).toBe(gestor)
    expect(l.atualizado_por).toBeNull()
    expect(l.atualizado_em).toBeNull()
  })

  test('criado_por forjado é sobrescrito', async () => {
    await banco.comoUsuario(gestor, (e) =>
      e("INSERT INTO usuario (nome, email, papel, criado_por) VALUES ('F', 'f@teste.local', 'vendedor', $1)", [
        outroGestor,
      ]),
    )
    const [l] = await ler('f@teste.local')
    expect(l.criado_por).toBe(gestor)
  })

  test('seed sem identidade: criado_por nulo', async () => {
    const [l] = await ler('gestora@teste.local')
    expect(l.criado_por).toBeNull()
  })
})

describe('UPDATE', () => {
  test('criado_* congelados, atualizado_* preenchidos com quem alterou', async () => {
    const [antes] = await ler('n@teste.local')
    await banco.comoUsuario(outroGestor, (e) =>
      e("UPDATE usuario SET nome = 'N2', criado_por = $1 WHERE email = 'n@teste.local'", [outroGestor]),
    )
    const [depois] = await ler('n@teste.local')
    expect(depois.criado_por).toBe(antes.criado_por)
    expect(depois.criado_em.getTime()).toBe(antes.criado_em.getTime())
    expect(depois.atualizado_por).toBe(outroGestor)
    expect(depois.atualizado_em).not.toBeNull()
  })
})
