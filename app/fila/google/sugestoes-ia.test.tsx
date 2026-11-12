import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { sugerirFiltrosGoogleAcao } from './sugestoes-ia'

const { exigir } = vi.hoisted(() => ({ exigir: vi.fn(async () => ({ usuarioId: 'vendedor-teste' })) }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir }))

const requisicao = vi.fn<typeof fetch>()
const descricao = 'Quero vender câmeras Wi-Fi no Brás, em São Paulo.'
const sugestoes = [
  { titulo: 'Lojas de segurança eletrônica', descricao: 'Podem revender câmeras.', nicho: 'Lojas de segurança eletrônica', termos: 'câmeras Wi-Fi, CFTV' },
  { titulo: 'Instaladores', descricao: 'Podem instalar câmeras.', nicho: 'Instalação de câmeras', termos: 'instalação de CFTV, monitoramento' },
]
const dados = { regiao: { cidade: 'São Paulo', uf: 'SP', bairro: 'Brás' }, sugestoes }

function resposta(text: string, stop_reason = 'end_turn') {
  return Response.json({ stop_reason, content: [{ type: 'text', text }] })
}

beforeEach(() => {
  vi.stubEnv('CRM_GOOGLE_IA_ATIVA', '1')
  vi.stubEnv('ANTHROPIC_API_KEY', 'chave-ficticia')
  vi.stubEnv('CRM_GOOGLE_IA_MODELO', '')
  vi.stubGlobal('fetch', requisicao)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

test.each([['0', 'chave-ficticia'], ['1', ''], ['1', '   ']])('responde Em breve sem acessar Claude com configuração incompleta (%j, %j)', async (flag, chave) => {
  vi.stubEnv('CRM_GOOGLE_IA_ATIVA', flag)
  vi.stubEnv('ANTHROPIC_API_KEY', chave)
  expect(await sugerirFiltrosGoogleAcao(descricao)).toEqual({ ok: false, motivo: 'O assistente de filtros estará disponível em breve.' })
  expect(requisicao).not.toHaveBeenCalled()
})

test('exige vendedor antes de usar Claude', async () => {
  exigir.mockRejectedValueOnce(new Error('acesso negado'))
  await expect(sugerirFiltrosGoogleAcao(descricao)).rejects.toThrow('acesso negado')
  expect(exigir).toHaveBeenCalledWith('vendedor')
  expect(requisicao).not.toHaveBeenCalled()
})

test('envia somente a descrição a Claude Haiku e devolve opções com região validada', async () => {
  requisicao.mockResolvedValueOnce(resposta(JSON.stringify(dados)))
  const retorno = await sugerirFiltrosGoogleAcao(descricao)
  expect(retorno).toMatchObject({ ok: true, valor: dados })
  expect(requisicao).toHaveBeenCalledTimes(1)
  const [url, init] = requisicao.mock.calls[0]
  expect(url).toBe('https://api.anthropic.com/v1/messages')
  expect(init?.headers).toMatchObject({ 'x-api-key': 'chave-ficticia', 'anthropic-version': '2023-06-01' })
  expect(JSON.parse(String(init?.body))).toMatchObject({
    model: 'claude-haiku-5-5',
    messages: [{ role: 'user', content: descricao }],
    output_config: { format: { type: 'json_schema' } },
  })
  expect(JSON.parse(String(init?.body))).not.toHaveProperty('tools')
})

test('entrada em branco ou longa demais não usa créditos', async () => {
  for (const texto of ['  ', 'a'.repeat(601)]) expect(await sugerirFiltrosGoogleAcao(texto)).toMatchObject({ ok: false })
  expect(requisicao).not.toHaveBeenCalled()
})

test.each(['Quero vender câmeras.', 'Quero vender câmeras em São Paulo.'])('preserva a região quando Claude devolve cidade ou bairro ausente da descrição (%j)', async texto => {
  requisicao.mockResolvedValueOnce(resposta(JSON.stringify(dados)))
  expect(await sugerirFiltrosGoogleAcao(texto)).toEqual({ ok: true, valor: { sugestoes } })
})

test.each([
  ['JSON inválido', () => resposta('texto inválido')],
  ['região inválida', () => resposta(JSON.stringify({ ...dados, regiao: { ...dados.regiao, uf: 'ZZ' } }))],
  ['resposta interrompida', () => resposta(JSON.stringify(dados), 'max_tokens')],
  ['campo não permitido', () => resposta(JSON.stringify({ ...dados, sugestoes: [{ ...sugestoes[0], nota: 4.8 }] }))],
])('recusa %s sem expor a resposta do provedor', async (_caso, criar) => {
  requisicao.mockResolvedValueOnce(criar())
  expect(await sugerirFiltrosGoogleAcao(descricao)).toMatchObject({ ok: false })
})

test('falha de créditos deixa mensagem útil e não repete a solicitação', async () => {
  requisicao.mockResolvedValueOnce(Response.json({ error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }, { status: 400 }))
  expect(await sugerirFiltrosGoogleAcao(descricao)).toEqual({ ok: false, motivo: 'O assistente está indisponível no momento. Você pode preencher os critérios manualmente.' })
  expect(requisicao).toHaveBeenCalledTimes(1)
})
