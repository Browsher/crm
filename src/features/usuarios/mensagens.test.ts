import { expect, test } from 'vitest'
import { mensagemDeUsuario } from './mensagens'

test('um texto por motivo', () => {
  expect(mensagemDeUsuario({ ok: false, motivo: 'sem_permissao' })).toBe('Você não tem permissão para isso.')
  expect(mensagemDeUsuario({ ok: false, motivo: 'nao_encontrado' })).toBe('Usuário não encontrado. Recarregue a lista.')
  expect(mensagemDeUsuario({ ok: false, motivo: 'email_em_uso' })).toBe('Já existe usuário com esse e-mail.')
  expect(mensagemDeUsuario({ ok: false, motivo: 'dados_invalidos', faltas: ['nome_vazio'] })).toBe('Preencha o nome.')
  expect(mensagemDeUsuario({ ok: false, motivo: 'dados_invalidos', faltas: ['nome_vazio', 'email_invalido', 'papel_invalido'] })).toBe(
    'Preencha o nome, informe um e-mail válido e escolha um papel válido.',
  )
})
