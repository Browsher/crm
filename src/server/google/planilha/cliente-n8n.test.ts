import { expect, test } from 'vitest'
import { configuracaoPlanilha } from './configuracao'
import { criarClientePlanilha, celulasDoPedido, type PayloadPlanilha } from './cliente'

const env = {
  GOOGLE_PLANILHA_ID: 'planilha-teste',
  GOOGLE_PLANILHA_ABA_ID: '123',
  GOOGLE_PLANILHA_N8N_URL: 'https://n8n.exemplo.test/webhook/crm-planilha',
  GOOGLE_PLANILHA_N8N_TOKEN: 'token-ficticio-com-mais-de-32-caracteres',
}
const payload: PayloadPlanilha = {
  pedido: '00000000-0000-4000-8000-000000000001', envio_id: '00000000-0000-4000-8000-000000000003',
  linha: 2, versao: 2, revisao: 3, anteriores: [], contrato: 2,
  dados: { id: '00000000-0000-4000-8000-000000000001', vendedor_id: '00000000-0000-4000-8000-000000000002',
    vendedor: 'Vendedor fictício', dia: '2026-10-26', nicho: '=IMPORTXML("literal")', bairro: '', cidade: 'São Paulo',
    uf: 'SP', estado: 'planejado', atualizado_em: '2026-10-25T15:00:00.000Z', criterios: { telefone: ['fixo'] } },
}
const configurar = () => {
  const c = configuracaoPlanilha(env)
  expect(c).not.toBeNull()
  return c!
}
const recibo = () => ({ protocolo: 1, estado: 'sincronizado', planilha_id: env.GOOGLE_PLANILHA_ID, aba_id: 123,
  pedido_id: payload.pedido, envio_id: payload.envio_id, linha: payload.linha, revisao: payload.revisao,
  versao: payload.versao, celulas: celulasDoPedido(payload) })

test('configura a conexão n8n existente sem chave privada Google', () => {
  expect(configuracaoPlanilha(env)).toMatchObject({ transporte: 'n8n', planilhaId: 'planilha-teste', abaId: 123,
    url: env.GOOGLE_PLANILHA_N8N_URL, token: env.GOOGLE_PLANILHA_N8N_TOKEN })
})
test.each([
  { GOOGLE_PLANILHA_N8N_URL: 'http://n8n.test/webhook' },
  { GOOGLE_PLANILHA_N8N_URL: 'https://usuario:senha@n8n.test/webhook' },
  { GOOGLE_PLANILHA_N8N_URL: 'https://n8n.test/webhook?token=segredo' },
  { GOOGLE_PLANILHA_N8N_URL: 'https://n8n.test/webhook#segredo' },
  { GOOGLE_PLANILHA_N8N_TOKEN: 'curto' },
  { GOOGLE_PLANILHA_N8N_TOKEN: 'x'.repeat(40) + '\n' },
  { GOOGLE_PLANILHA_ABA_ID: '2147483648' },
])('configuração inválida não habilita envio: %j', alteracao => {
  expect(configuracaoPlanilha({ ...env, ...alteracao })).toBeNull()
})
test('envia a linha fixa e só confirma recibo idêntico, sem obter token Google', async () => {
  let chamadas = 0
  const fetcher: typeof fetch = async (input, init) => {
    chamadas++
    expect(String(input)).toBe(env.GOOGLE_PLANILHA_N8N_URL)
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: {
      Authorization: 'Bearer ' + env.GOOGLE_PLANILHA_N8N_TOKEN, 'Content-Type': 'application/json' } })
    const b = JSON.parse(String(init!.body))
    expect(b).toMatchObject({ protocolo: 1, operacao: 'sincronizar', planilha_id: 'planilha-teste', aba_id: 123,
      pedido_id: payload.pedido, envio_id: payload.envio_id, linha: 2, revisao: 3, versao: 2, anteriores: [] })
    expect(b.celulas).toEqual(celulasDoPedido(payload))
    expect(b.celulas[6]).toBe('=IMPORTXML("literal")')
    return Response.json(recibo())
  }
  const operacao = { incerta: false }
  const cliente = await criarClientePlanilha(configurar(), fetcher).conectar()
  await cliente.gravar(payload, operacao)
  expect(chamadas).toBe(1)
  expect(operacao.incerta).toBe(false)
})
test.each(['perda', 'http', 'pedido', 'envio', 'revisao', 'versao', 'linha', 'destino', 'aba', 'protocolo', 'estado', 'celulas', 'grande'])('retorno %s mantém envio incerto sem repetir', async caso => {
  let chamadas = 0
  const fetcher: typeof fetch = async () => {
    chamadas++
    if (caso === 'perda') throw new Error('falha contendo um segredo fictício')
    if (caso === 'http') return Response.json({}, { status: 500 })
    const r = recibo()
    if (caso === 'pedido') r.pedido_id = 'outro'
    if (caso === 'envio') r.envio_id = 'outro'
    if (caso === 'revisao') r.revisao++
    if (caso === 'versao') r.versao++
    if (caso === 'linha') r.linha++
    if (caso === 'destino') r.planilha_id = 'outro'
    if (caso === 'aba') r.aba_id++
    if (caso === 'protocolo') r.protocolo++
    if (caso === 'estado') r.estado = 'incompleto'
    if (caso === 'celulas') r.celulas[6] = 'divergente'
    if (caso === 'grande') return new Response(' '.repeat(256001))
    return Response.json(r)
  }
  const cliente = await criarClientePlanilha(configurar(), fetcher).conectar()
  const operacao = { incerta: false }
  await expect(cliente.gravar(payload, operacao)).rejects.toThrow('Gravação não confirmada')
  expect(operacao.incerta).toBe(true)
  expect(chamadas).toBe(1)
})
test('entrada local inválida ou muito grande não sai do CRM e não vira escrita incerta', async () => {
  let chamadas = 0
  const cliente = await criarClientePlanilha(configurar(), async () => { chamadas++; return Response.json(recibo()) }).conectar()
  for (const p of [{ ...payload, linha: 1 }, { ...payload, envio_id: undefined },
    { ...payload, anteriores: [Array.from({ length: 14 }, () => 'x'.repeat(10000))] }]) {
    const operacao = { incerta: false }
    await expect(cliente.gravar(p, operacao)).rejects.toThrow()
    expect(operacao.incerta).toBe(false)
  }
  expect(chamadas).toBe(0)
})
