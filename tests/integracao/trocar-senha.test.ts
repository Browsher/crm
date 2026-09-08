import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { entrar } from '@/src/server/autenticacao/entrar'
import { criarSessao, lerSessao } from '@/src/server/autenticacao/sessao'
import { trocarSenha } from '@/src/server/autenticacao/trocar-senha'
import { criarBancoDeTeste, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let id: string
let token: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  ;({ id } = await criarUsuarioComSenha(banco, 'gestor', 'Gestora', 'provisoria-1', { pendente: true }))
  ;({ token } = await criarSessao(id))
})
afterAll(async () => {
  await banco.derrubar()
})

describe('trocarSenha', () => {
  test('senha fraca: faltas nomeadas, sem tocar a credencial', async () => {
    expect(await trocarSenha({ token, senhaAtual: 'provisoria-1', senhaNova: 'curta' })).toEqual({ ok: false, motivo: 'senha_fraca', faltas: ['minimo'] })
    expect(await trocarSenha({ token, senhaAtual: 'provisoria-1', senhaNova: 'provisoria-1' })).toEqual({ ok: false, motivo: 'senha_fraca', faltas: ['igual_atual'] })
  })

  test('sem sessão', async () => {
    expect(await trocarSenha({ token: 'nao-existe', senhaAtual: 'provisoria-1', senhaNova: 'definitiva-1' })).toEqual({ ok: false, motivo: 'sem_sessao' })
  })

  test('senha atual errada', async () => {
    expect(await trocarSenha({ token, senhaAtual: 'errada-123', senhaNova: 'definitiva-1' })).toEqual({ ok: false, motivo: 'senha_atual_invalida' })
  })

  test('sucesso: nova entra, antiga não, marca cai, outra sessão morre e a atual vive', async () => {
    const outra = await criarSessao(id)
    expect(await trocarSenha({ token, senhaAtual: 'provisoria-1', senhaNova: 'definitiva-1' })).toEqual({ ok: true })
    expect(await lerSessao(token)).toMatchObject({ senhaProvisoriaPendente: false })
    expect(await lerSessao(outra.token)).toBeNull()
    expect(await entrar({ email: 'gestora@teste.local', senha: 'provisoria-1', origem: null })).toEqual({ ok: false, motivo: 'credenciais_invalidas' })
    expect(await entrar({ email: 'gestora@teste.local', senha: 'definitiva-1', origem: null })).toMatchObject({ ok: true, precisaTrocarSenha: false })
  })
})
