import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarSessao, encerrarSessao, lerSessao } from '@/src/server/autenticacao/sessao'
import { criarBancoDeTeste, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let id: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  ;({ id } = await criarUsuarioComSenha(banco, 'gestor', 'Gestora', 'senha-forte-1'))
})
afterAll(async () => {
  await banco.derrubar()
})

test('criar, ler e encerrar; o banco guarda o hash, não o token', async () => {
  const criada = await criarSessao(id, '1')
  expect(criada.ok).toBe(true)
  if (!criada.ok) throw new Error('sessão recusada')
  const { token, expiraEm } = criada
  const s = await lerSessao(token)
  expect(s).toMatchObject({ usuarioId: id, nome: 'Gestora', email: 'gestora@teste.local', papel: 'gestor', senhaProvisoriaPendente: false })
  expect(s?.expiraEm.getTime()).toBe(expiraEm.getTime())
  const linhas = await banco.sql<{ token_hash: string }>('SELECT token_hash FROM autenticacao.sessao WHERE usuario_id = $1', [id])
  expect(linhas).toHaveLength(1)
  expect(linhas[0].token_hash).not.toBe(token)
  expect(linhas[0].token_hash).toMatch(/^[0-9a-f]{64}$/)
  await encerrarSessao(token)
  expect(await lerSessao(token)).toBeNull()
})

test('token desconhecido resolve nulo', async () => {
  expect(await lerSessao('nao-existe')).toBeNull()
})
