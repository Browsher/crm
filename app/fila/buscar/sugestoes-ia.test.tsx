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
  expect(await sugerirFiltrosBancoAcao(descricao + ' Inclua atividades secundárias.')).toMatchObject({ ok: true, valor: {
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
