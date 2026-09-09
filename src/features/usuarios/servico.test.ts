import { describe, expect, test } from 'vitest'
import type { RepositorioUsuarios } from './repositorio'
import { criarUsuario } from './servico'

// Repositório que explode se for chamado: validação tem que barrar antes.
const nuncaChamado: RepositorioUsuarios = {
  listar: () => Promise.reject(new Error('não devia chamar')),
  criar: () => Promise.reject(new Error('não devia chamar')),
  definirCredencial: () => Promise.reject(new Error('não devia chamar')),
  alterar: () => Promise.reject(new Error('não devia chamar')),
  desativar: () => Promise.reject(new Error('não devia chamar')),
}

describe('criarUsuario', () => {
  test('dados inválidos: faltas nomeadas, sem tocar o repositório nem gerar hash', async () => {
    const r = await criarUsuario(nuncaChamado, { nome: ' ', email: 'x', papel: 'vendedor' })
    expect(r).toEqual({ ok: false, motivo: 'dados_invalidos', faltas: ['nome_vazio', 'email_invalido'] })
  })
})
