import { afterEach, expect, test, vi } from 'vitest'
import { criarClienteCnpjBiz } from './cliente'
import { validarFiltros } from '@/src/features/busca-empresas/filtros'

const filtros = () => {
  const r = validarFiltros({ palavra: 'iluminação', uf: 'SP', quantidade: '2' })
  if (!r.ok) throw new Error('fixture inválida')
  return r.filtros
}
const empresa = {
  cnpj: '11222333000181', razao_social: 'Loja teste LTDA', nome_fantasia: 'Loja teste', email: 'COMERCIAL@EXEMPLO.TEST',
  telefones: ['(11) 98888-7777', '(11) 3333-2222'], telefones_tipo: ['celular', 'comercial'],
  atividades_principal: ['47.42-3-00 - Comércio varejista de material elétrico'], atividades_secundarias: [],
  situacao: 'ATIVA', porte_empresa: 'ME', data_abertura: '2020-01-15',
  endereco: { cep: '01001-000', logradouro: 'Praça teste', numero: '10', complemento: 'Sala 2', bairro: 'Centro',
    cidade: { nome: 'São Paulo' }, estado: { sigla: 'SP' } },
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
test('chama o endpoint de listagem com Bearer, filtros e telefones no formato documentado', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([empresa])))
  const r = await criarClienteCnpjBiz('chave-teste', fetcher).buscar(filtros())
  expect(fetcher).toHaveBeenCalledTimes(1)
  const [url, init] = fetcher.mock.calls[0]
  expect(url).toBe('https://cnpj.biz/api/v2/empresas/listar-com-dados')
  expect(init.headers.Authorization).toBe('Bearer chave-teste')
  expect(init.cache).toBe('no-store')
  expect(init.redirect).toBe('error')
  expect(JSON.parse(init.body)).toMatchObject({ limit: 2, offset: 0, razao_fantasia: ['iluminação'], situacao: ['ativa'], localidades: [{ tipo: 'estado', estado: 'SP', pais: 'BR' }], socios: false })
  expect(r.ok && r.empresas[0]).toMatchObject({ cnpj: '11222333000181', telefone: '11988887777', email: 'comercial@exemplo.test', cnae_principal: '4742300', numero: '10', cidade: 'São Paulo', telefones: ['11988887777', '1133332222'] })
})
test('resolve o código CNAE para atividade_id antes da chamada paga', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([{ atividade_id: 123, codigo: '47.42-3-00', nome: 'Material elétrico' }])))
    .mockResolvedValueOnce(new Response(JSON.stringify([])))
  const r = await criarClienteCnpjBiz('chave-teste', fetcher).buscar({ ...filtros(), cnae: '4742300' })
  expect(r).toEqual({ ok: true, empresas: [] })
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ atividades: [123], atividade_tipo: ['principal'] })
})
test('CNAE não encontrado não é removido silenciosamente dos filtros', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('[]'))
  expect(await criarClienteCnpjBiz('chave-teste', fetcher).buscar({ ...filtros(), cnae: '4742300' })).toEqual({ ok: false, motivo: 'cnae_nao_encontrado' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
test('preserva empresa sem telefone na conferência sem inventar contato', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...empresa, telefones: [] }])))
  const r = await criarClienteCnpjBiz('chave-teste', fetcher).buscar(filtros())
  expect(r.ok && r.empresas[0].telefone).toBeNull()
})
test.each([[401, 'credencial_invalida'], [402, 'sem_creditos'], [429, 'fornecedor_ocupado'], [500, 'fornecedor_indisponivel']])('erro %s não repete requisição nem expõe corpo do fornecedor', async (status, motivo) => {
  const fetcher = vi.fn().mockResolvedValue(new Response('segredo-do-fornecedor', { status }))
  expect(await criarClienteCnpjBiz('chave-teste', fetcher).buscar(filtros())).toEqual({ ok: false, motivo })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
test('falha de rede fica explícita sem retry automático', async () => {
  const fetcher = vi.fn().mockRejectedValue(new TypeError('request chave-teste'))
  expect(await criarClienteCnpjBiz('chave-teste', fetcher).buscar(filtros())).toEqual({ ok: false, motivo: 'fornecedor_indisponivel' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
test.each(['{}', '[{"cnpj":"invalido"}]', 'não é JSON'])('resposta inválida falha fechada: %s', async corpo => {
  const fetcher = vi.fn().mockResolvedValue(new Response(corpo))
  expect(await criarClienteCnpjBiz('chave-teste', fetcher).buscar(filtros())).toEqual({ ok: false, motivo: 'resposta_invalida' })
})
test('limita o tamanho da resposta antes de normalizar e impede consulta sem chave', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('[]', { headers: { 'content-length': '3000000' } }))
  expect(await criarClienteCnpjBiz('chave-teste', fetcher).buscar(filtros())).toEqual({ ok: false, motivo: 'resposta_invalida' })
  fetcher.mockClear()
  expect(await criarClienteCnpjBiz('', fetcher).buscar(filtros())).toEqual({ ok: false, motivo: 'nao_configurado' })
  expect(fetcher).not.toHaveBeenCalled()
})
