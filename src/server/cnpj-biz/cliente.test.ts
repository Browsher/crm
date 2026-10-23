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
test('deduplicação de telefone, email e exportadas é fixa em qualquer consulta',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response('[]'))
  await criarClienteCnpjBiz('chave-teste',fetcher).buscar(filtros())
  expect(JSON.parse(fetcher.mock.calls[0][1].body).avancado).toEqual(['numero','email','exportei'])
})

test('contagem chama somente o endpoint de contar e não lista empresas',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({result:true,count:'28'}))
  expect(await criarClienteCnpjBiz('chave-teste',fetcher).contar(filtros())).toEqual({ok:true,quantidade:28})
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toBe('https://cnpj.biz/api/v2/empresas/contar')
})

test('mapeia filtros completos incluindo naturezas, faixas e múltiplas regiões',async()=>{
  const r=validarFiltros({palavra:'teste',uf:'SP',quantidade:'2',avancados:JSON.stringify({versao:1,palavras:['brinquedos'],cnaes:[],naturezas:['2062'],atividadeTipo:['principal','secundaria'],regioes:[{estado:'SP',cidade:'São Paulo',bairros:['Brás','Sé']},{estado:'RJ',cidade:'Rio de Janeiro',bairros:[]}],portes:['ME'],tipos:['2'],situacoes:['ativa','suspensa'],regimes:['Lucro Real'],capitalMinimo:'1000.00',capitalMaximo:'',aberturaDe:'2020-01-01',aberturaAte:'',contato:'celular',ddds:['11','21'],semEmailContabil:true,socios:true})})
  expect(r.ok).toBe(true)
  if(!r.ok) return
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([{natureza_juridica_id:10,codigo:'206-2',nome:'Ltda'}]))).mockResolvedValueOnce(new Response('[]'))
  await criarClienteCnpjBiz('chave-teste',fetcher).buscar(r.filtros)
  expect(fetcher).toHaveBeenCalledTimes(2)
  const pedido=JSON.parse(fetcher.mock.calls[1][1].body)
  expect(pedido).toMatchObject({natureza_juridica:[10],capital_minimo:'1.000,00',data_abertura_inicio:'01/01/2020',contato:'celular',socios:true,ddd:['11','21'],avancado:['numero','email','exportei','sememailcontab'],situacao:['ativa','suspensa']})
  expect(pedido.localidades).toHaveLength(2)
  expect(pedido.bairros).toHaveLength(2)
})
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

test('preserva detalhes empresariais e sócios para persistência protegida no servidor',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify([{...empresa,capital_social:'20000.00',natureza_juridica:'Sociedade Empresária Limitada',regime_tributario:['Simples Nacional'],socios:[{nome:'Sócio fictício',cnpj_cpf_socio:'***000***',funcao:{codigo:'49',descricao:'Sócio-Administrador'}}]}])))
  const r=await criarClienteCnpjBiz('chave-teste',fetcher).buscar(filtros())
  expect(r.ok&&r.empresas[0]).toHaveProperty('detalhes.capital_social','20000.00')
  expect(r.ok&&r.empresas[0]).toHaveProperty('detalhes.socios.0.nome','Sócio fictício')
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

test('timeout não vira retry e não devolve detalhes de rede', async () => {
  const fetcher = vi.fn().mockRejectedValue(new DOMException('chave-teste', 'TimeoutError'))
  expect(await criarClienteCnpjBiz('chave-teste', fetcher).buscar(filtros())).toEqual({ ok: false, motivo: 'tempo_esgotado' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('consulta o CNAE na máscara publicada pelo fornecedor, preservando zeros à esquerda', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([{ atividade_id: 123, codigo: '01.11-3-01', nome: 'Atividade fictícia' }])))
    .mockResolvedValueOnce(new Response('[]'))
  await criarClienteCnpjBiz('chave-teste', fetcher).buscar({ ...filtros(), cnae: '0111301' })
  expect(JSON.parse(fetcher.mock.calls[0][1].body).busca).toBe('01.11-3-01')
})
