import { expect, test } from 'vitest'
import { acaoEmpresa, rotuloSituacao, type ResumoEmpresa, type SituacaoEmpresa } from './empresa-visual'

export const empresaTeste: ResumoEmpresa = { referencia: { tipo: 'cadastro', empresaId: 'empresa' }, id: 'empresa', nome: 'Loja', cnpj: null, cnae: null, atividade: null, bairro: null, cidade: null, uf: null, origens: ['google'], recebidaEm: null, situacao: 'a_contatar', versao: 7, negociacaoId: null }
test.each<[SituacaoEmpresa, string]>([['a_contatar','Iniciar atendimento'],['atendimento','Continuar atendimento'],['primeiro_contato','Abrir no funil'],['em_negociacao','Abrir no funil'],['proposta_enviada','Abrir no funil'],['cliente','Abrir na carteira'],['sem_interesse','Retomar atendimento']])('ação comum para %s', (situacao, rotulo) => {
  expect(acaoEmpresa({ ...empresaTeste, situacao, negociacaoId: 'negociacao' })?.rotulo).toBe(rotulo)
  expect(rotuloSituacao(situacao)).toBeTruthy()
})
test('snapshot e indisponibilidade não concedem ações, mesmo com ID global correspondente', () => {
  expect(acaoEmpresa({ ...empresaTeste, referencia: { tipo: 'busca', buscaId: 'busca', cnpj: '12345678000199' } })).toBeNull()
  expect(acaoEmpresa({ ...empresaTeste, situacao: 'indisponivel' })).toBeNull()
  expect(acaoEmpresa({ ...empresaTeste, versao: null })).toBeNull()
  expect(acaoEmpresa({ ...empresaTeste, id: null })).toBeNull()
})
test('funil usa negociação e ausência não inventa destino', () => {
  expect(acaoEmpresa({ ...empresaTeste, situacao: 'em_negociacao', negociacaoId: 'a/b' })).toMatchObject({ href: '/funil?negociacao=a%2Fb' })
  expect(acaoEmpresa({ ...empresaTeste, situacao: 'em_negociacao' })).toBeNull()
})
