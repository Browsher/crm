import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { sugerirFiltrosBancoAcao } from './sugestoes-ia'

const { exigir } = vi.hoisted(() => ({ exigir: vi.fn(async () => ({ usuarioId: 'vendedor-teste' })) }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir }))
const requisicao = vi.fn<typeof fetch>()
const descricao = 'Quero vender produtos para armarinhos no Brás, em São Paulo.'
const lojas = { titulo: 'Armarinhos', descricao: 'Compram artigos para revenda.', cnaes: ['4755502', '9999999'] }
const regiao = { cidade: 'São Paulo', uf: 'SP', bairro: 'Brás' }

function resposta(sugestoes: object[] = [lojas], local = regiao) {
  return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ sugestoes, regiao: local }) }] })
}

beforeEach(() => {
  vi.stubEnv('CRM_BANCO_IA_ATIVA', '1')
  vi.stubEnv('CRM_GOOGLE_IA_ATIVA', '0')
  vi.stubEnv('ANTHROPIC_API_KEY', 'chave-ficticia')
  vi.stubEnv('CRM_ASSISTENTE_IA_MODELO', '')
  vi.stubGlobal('fetch', requisicao)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

test('Banco fica desativado mesmo quando o assistente do Google está ativo', async () => {
  vi.stubEnv('CRM_GOOGLE_IA_ATIVA', '1')
  vi.stubEnv('CRM_BANCO_IA_ATIVA', '0')
  expect(await sugerirFiltrosBancoAcao(descricao)).toMatchObject({ ok: false })
  expect(exigir).toHaveBeenCalledWith('vendedor')
  expect(requisicao).not.toHaveBeenCalled()
})

test('Banco fica desativado quando a chave Claude ainda não foi configurada', async () => {
  vi.stubEnv('ANTHROPIC_API_KEY', '')
  expect(await sugerirFiltrosBancoAcao(descricao)).toMatchObject({ ok: false })
  expect(requisicao).not.toHaveBeenCalled()
})

test('confirma apenas CNAEs oficiais sem depender da API do IBGE ou consultar empresas', async () => {
  requisicao.mockResolvedValueOnce(resposta())
  expect(await sugerirFiltrosBancoAcao(descricao)).toMatchObject({ ok: true, valor: {
    regiao, sugestoes: [{ titulo: lojas.titulo, cnaes: [{ codigo: '4755502', descricao: 'COMERCIO VAREJISTA DE ARTIGOS DE ARMARINHO' }] }],
  } })
  expect(requisicao).toHaveBeenCalledTimes(1)
  expect(String(requisicao.mock.calls[0][0])).toBe('https://api.anthropic.com/v1/messages')
  expect(JSON.parse(String(requisicao.mock.calls[0][1]?.body))).toMatchObject({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: descricao }] })
})

test('não permite aplicar CNAE ausente do catálogo oficial', async () => {
  requisicao.mockResolvedValueOnce(resposta([{ ...lojas, cnaes: ['9999999'] }]))
  expect(await sugerirFiltrosBancoAcao(descricao)).toMatchObject({ ok: false, motivo: expect.stringContaining('CNAE') })
  expect(requisicao).toHaveBeenCalledTimes(1)
})

test('preserva códigos com zero inicial e separa atividade principal da secundária', async () => {
  requisicao.mockResolvedValueOnce(resposta([{ ...lojas, cnaes: ['0111301'], cnaesSecundarios: ['4755502'] }]))
  expect(await sugerirFiltrosBancoAcao({ produto: { descricao: 'Quero empresas de cultivo de arroz' }, detalhes: 'Inclua armarinho como atividade secundária.' })).toMatchObject({ ok: true, valor: {
    sugestoes: [{ cnaes: [{ codigo: '0111301' }], cnaesSecundarios: [{ codigo: '4755502' }] }],
  } })
})

test('Banco ignora restrições de nome e CNAE secundário quando o vendedor não pede', async () => {
  requisicao.mockResolvedValueOnce(resposta([{ ...lojas, cnaes: ['4755502'], cnaesSecundarios: ['0111301'], palavras: ['armarinhos'] }]))
  expect(await sugerirFiltrosBancoAcao(descricao)).toMatchObject({ ok: true, valor: {
    sugestoes: [{ cnaes: [{ codigo: '4755502' }], cnaesSecundarios: [], palavras: [] }],
  } })
  expect(requisicao).toHaveBeenCalledTimes(1)
})

test('Banco preserva a localização se a UF sugerida conflita com a UF explícita', async () => {
  requisicao.mockResolvedValueOnce(resposta([lojas], { cidade: 'Santo Antônio', uf: 'SP', bairro: '' }))
  const resultado = await sugerirFiltrosBancoAcao('Quero vender para armarinhos em Santo Antônio, RN.')
  expect(resultado.ok).toBe(true)
  if (resultado.ok) expect(resultado.valor.regiao).toBeUndefined()
})

test('não coloca dois bairros no mesmo campo de localização', async () => {
  requisicao.mockResolvedValueOnce(resposta([lojas], { ...regiao, bairro: 'Brás, Sé' }))
  const resultado = await sugerirFiltrosBancoAcao('Quero vender para armarinhos no Brás, Sé, em São Paulo.')
  expect(resultado.ok).toBe(true)
  if (resultado.ok) expect(resultado.valor.regiao).toBeUndefined()
})

test('alternativas de títulos diferentes com os mesmos filtros confirmados aparecem uma vez', async () => {
  requisicao.mockResolvedValueOnce(resposta([lojas, { ...lojas, titulo: 'Comércio varejista', cnaes: ['4755502'] }]))
  const resultado = await sugerirFiltrosBancoAcao(descricao)
  expect(resultado.ok).toBe(true)
  if (resultado.ok) expect(resultado.valor.sugestoes.map(s => s.titulo)).toEqual(['Armarinhos'])
})

test('palavra citada para filtrar pelo nome pode ser aplicada sem consultar o IBGE', async () => {
  requisicao.mockResolvedValueOnce(resposta([{ titulo: 'Lojas', descricao: 'Lojas de armarinho.', palavras: ['armarinho', 'outra'] }]))
  expect(await sugerirFiltrosBancoAcao('Quero vender para lojas que tenham armarinho no nome.')).toMatchObject({
    ok: true, valor: { sugestoes: [{ palavras: ['armarinho'] }] },
  })
  expect(requisicao).toHaveBeenCalledTimes(1)
})

test('CNAEs de iluminação e instalação funcionam com a rede do IBGE indisponível', async () => {
  requisicao.mockResolvedValueOnce(resposta([
    { titulo: 'Lojas de iluminação', descricao: 'Revendedores de fitas LED.', cnaes: ['4754703'] },
    { titulo: 'Instaladores', descricao: 'Usam fitas LED em projetos.', cnaes: ['4321500'] },
  ]))
  requisicao.mockRejectedValue(new Error('A rede só deve ser usada para Claude'))
  expect(await sugerirFiltrosBancoAcao('Quero vender fitas LED no Brás, em São Paulo, SP.')).toMatchObject({
    ok: true, valor: { regiao, sugestoes: [
      { cnaes: [{ codigo: '4754703', descricao: 'COMÉRCIO VAREJISTA DE ARTIGOS DE ILUMINAÇÃO' }] },
      { cnaes: [{ codigo: '4321500', descricao: 'INSTALAÇÃO E MANUTENÇÃO ELÉTRICA' }] },
    ] },
  })
  expect(requisicao).toHaveBeenCalledTimes(1)
})

test('limita os CNAEs a cada perfil do SKU, exibe o escopo e envia somente a ficha escolhida', async () => {
  requisicao.mockResolvedValueOnce(resposta([
    { ...lojas, perfil: 'lojas', cnaes: ['4759899', '4649401', '4751201'] },
    { ...lojas, titulo: 'Distribuidores', perfil: 'distribuidores', cnaes: ['4649401'] },
  ]))
  const entrada = { produto: { sku: 'IC-8177' }, publico: 'lojas', regioes: [{ estado: 'SP', cidade: 'São Paulo', bairros: ['Brás', 'Sé'] }] }
  const resultado = await sugerirFiltrosBancoAcao(entrada)
  expect(resultado).toMatchObject({ ok: true, valor: { sugestoes: [
    { cnaes: [{ codigo: '4759899', amplo: true, motivo: expect.any(String) }] },
  ] } })
  if (resultado.ok) {
    expect(resultado.valor.sugestoes).toHaveLength(1)
    expect(resultado.valor.regiao).toBeUndefined()
  }
  const [, requisitada] = requisicao.mock.calls[0]
  const corpo = JSON.parse(String(requisitada?.body))
  expect(corpo.messages[0].content).toContain('IC-8177')
  expect(corpo.messages[0].content).toContain('4759899')
  expect(corpo.messages[0].content).toContain('Brás')
  expect(corpo.messages[0].content).not.toMatch(/QS-030|preco|gtin/i)
})

test('rejeita seleção inválida ou sem CNAE pertinente antes de consumir crédito', async () => {
  for (const produto of [
    { produto: { sku: '128GB' } },
    { produto: { sku: 'IC-8177' }, especialidade: 'Higiene bucal' },
    { produto: { sku: 'QS-030' }, publico: 'lojas' },
  ]) expect(await sugerirFiltrosBancoAcao(produto)).toMatchObject({ ok: false })
  expect(requisicao).not.toHaveBeenCalled()
})

test('rejeita CNAE oficial sem relação com o público do produto fora do catálogo', async () => {
  requisicao.mockResolvedValueOnce(resposta([{ ...lojas, cnaes: ['0111301'] }]))
  expect(await sugerirFiltrosBancoAcao({ produto: { descricao: 'Quero vender fitas LED para lojas de iluminação em SP.' } })).toMatchObject({ ok: false, motivo: expect.stringContaining('CNAE') })
})

test('descrição livre respeita o público explícito e não transforma exclusão em CNAE candidato', async () => {
  requisicao.mockResolvedValueOnce(resposta([{ ...lojas, cnaes: ['4754703', '4649406', '4763601'] }]))
  expect(await sugerirFiltrosBancoAcao({
    produto: { descricao: 'Fitas LED' }, publico: 'Lojistas de iluminação',
    detalhes: 'Excluir lojas de brinquedos.',
  })).toMatchObject({ ok: true, valor: { sugestoes: [
    { cnaes: [{ codigo: '4754703' }] },
  ] } })
})

test('pedido de evitar secundários não aplica CNAEs secundários', async () => {
  requisicao.mockResolvedValueOnce(resposta([{ ...lojas, cnaes: ['4754703'], cnaesSecundarios: ['4649406'] }]))
  expect(await sugerirFiltrosBancoAcao('Quero vender fitas LED. Não inclua CNAEs secundários.')).toMatchObject({
    ok: true, valor: { sugestoes: [{ cnaesSecundarios: [] }] },
  })
})

test('restringe palavras empresariais ao trecho em que o vendedor pede o filtro de nome', async () => {
  requisicao.mockResolvedValueOnce(resposta([{ ...lojas, cnaes: ['4754703'], palavras: ['LED', 'lâmpadas', 'Comercial'] }]))
  expect(await sugerirFiltrosBancoAcao('Fitas LED e lâmpadas para lojas de iluminação com Comercial no nome.')).toMatchObject({
    ok: true, valor: { sugestoes: [{ palavras: ['Comercial'] }] },
  })
})

test('reconhece pet shop em descrição livre e aceita seu CNAE oficial', async () => {
  requisicao.mockResolvedValueOnce(resposta([{ ...lojas, cnaes: ['4789004'] }]))
  expect(await sugerirFiltrosBancoAcao('Quero vender ração para pet shops.')).toMatchObject({
    ok: true, valor: { sugestoes: [{ cnaes: [{ codigo: '4789004' }] }] },
  })
})
