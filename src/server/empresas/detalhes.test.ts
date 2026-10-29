import { beforeEach, expect, test, vi } from 'vitest'
const m = vi.hoisted(() => ({ como: vi.fn(), sql: vi.fn() }))
vi.mock('../db/como-usuario', () => ({ comoUsuario: m.como }))
import { lerDetalhesEmpresa } from './detalhes'
import { lerAtendimento } from '../atendimento/consulta'
const id = '10000000-0000-4000-8000-000000000001'
beforeEach(() => { vi.clearAllMocks(); m.como.mockImplementation((_id, fn) => fn(m.sql)) })
test('referência malformada não consulta e cadastro usa só leitura com identidade recebida', async () => {
  expect(await lerDetalhesEmpresa(id, { tipo: 'cadastro', empresaId: 'arbitrario' })).toEqual({ ok: false, motivo: 'nao_encontrada' })
  expect(m.sql).not.toHaveBeenCalled()
  m.sql.mockResolvedValue({ linhas: [{ resultado: { ok: false, motivo: 'sem_permissao' } }] })
  expect(await lerDetalhesEmpresa(id, { tipo: 'cadastro', empresaId: id })).toEqual({ ok: false, motivo: 'sem_permissao' })
  expect(m.como).toHaveBeenCalledWith(id, expect.any(Function))
  expect(m.sql).toHaveBeenCalledWith('SELECT empresa_detalhes_ler($1) AS resultado', [id])
})
test('snapshot seleciona CNPJ exato e nunca consulta empresa global', async () => {
  m.sql.mockResolvedValue({ linhas: [{ resultado: { ok: true, empresa: { cnpj: '12345678000199', razao_social: 'B', telefones: [] }, recebidaEm: null } }] })
  const r = await lerDetalhesEmpresa(id, { tipo: 'busca', buscaId: id, cnpj: '12345678000199' })
  expect(r).toMatchObject({ ok: true, dados: { nome: 'B', id: null, versao: null, referencia: { tipo: 'busca' } } })
  expect(m.sql).toHaveBeenCalledExactlyOnceWith('SELECT busca_empresa_detalhes_ler($1,$2) AS resultado', [id, '12345678000199'])
})
test('leitura de atendimento deriva fase sem incluir contatos e nega indisponibilidade', async () => {
  m.sql.mockResolvedValue({ linhas: [{ resultado: { ok: true, dados: { id, nome: 'Loja', situacao: 'primeiro_contato', telefone: 'privado', email: 'privado' } } }] })
  const r = await lerAtendimento(id, id)
  expect(r).toMatchObject({ ok: true, fase: 'negociacao' })
  expect(JSON.stringify(r)).not.toContain('privado')
  m.sql.mockResolvedValue({ linhas: [{ resultado: { ok: true, dados: { situacao: 'indisponivel' } } }] })
  expect(await lerAtendimento(id, id)).toEqual({ ok: false, motivo: 'sem_permissao' })
})
test('SQL recusa ator inativo sem expor detalhes e falhas de infraestrutura propagam', async () => {
  m.como.mockRejectedValueOnce({ code: '42501' }).mockRejectedValueOnce(new Error('infra'))
  expect(await lerDetalhesEmpresa(id, { tipo: 'cadastro', empresaId: id })).toEqual({ ok: false, motivo: 'sem_permissao' })
  await expect(lerDetalhesEmpresa(id, { tipo: 'cadastro', empresaId: id })).rejects.toThrow('infra')
})
