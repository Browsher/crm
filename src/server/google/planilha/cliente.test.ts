import { generateKeyPairSync, verify } from 'node:crypto'
import { expect, test } from 'vitest'
import { criarClientePlanilha, celulasDoPedido, CABECALHO_PLANILHA, CABECALHO_LEGADO, type PayloadPlanilha } from './cliente'
import { configuracaoPlanilha } from './configuracao'

const chaves = generateKeyPairSync('rsa', { modulusLength: 2048 })
const config = { planilhaId: 'planilha-fixture', abaId: 123, email: 'robot@projeto.iam.gserviceaccount.com', chave: chaves.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }
const payload: PayloadPlanilha = { pedido: '00000000-0000-4000-8000-000000000001', linha: 2, versao: 1, revisao: 1, anteriores: [], dados: {
  id: '00000000-0000-4000-8000-000000000001', vendedor_id: '00000000-0000-4000-8000-000000000002', vendedor: 'Vendedor teste',
  dia: '2026-10-22', nicho: '=IMPORTXML("x")', bairro: '', cidade: 'São Paulo', uf: 'SP', estado: 'planejado', atualizado_em: '2026-10-22T10:00:00.000Z' } }
function provedor({ outraAba = false, ocupado = false, retornoErrado = false, incerto = false, alterado = false } = {}) {
  let linha: unknown[] = ocupado ? ['outro-pedido'] : alterado ? [payload.pedido, '1', 'nome modificado manualmente'] : []
  let escritas = 0
  const fetcher: typeof fetch = async (input, init) => {
    const u = new URL(String(input))
    expect(init?.redirect).toBe('error')
    if (u.hostname === 'oauth2.googleapis.com') {
      const params = new URLSearchParams(String(init?.body))
      expect(params.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
      const [cabecalho,corpo,assinatura] = params.get('assertion')!.split('.')
      expect(verify('RSA-SHA256',Buffer.from(cabecalho+'.'+corpo),chaves.publicKey,Buffer.from(assinatura,'base64url'))).toBe(true)
      expect(JSON.parse(Buffer.from(corpo,'base64url').toString())).toMatchObject({ iss: config.email, aud: 'https://oauth2.googleapis.com/token', scope: 'https://www.googleapis.com/auth/spreadsheets' })
      return Response.json({access_token:'token-ficticio',token_type:'Bearer',expires_in:3600})
    }
    expect(u.hostname).toBe('sheets.googleapis.com')
    expect(init?.headers).toMatchObject({Authorization:'Bearer token-ficticio'})
    if (!u.pathname.includes('/values/')) return Response.json({spreadsheetId:config.planilhaId,sheets:[{properties:{sheetId:outraAba?456:123,title:'Planejamento CRM',gridProperties:{rowCount:1000,columnCount:14}}}]})
    const intervalo = decodeURIComponent(u.pathname.split('/values/')[1])
    if (intervalo.endsWith('A1:M1')) return Response.json({values:[CABECALHO_LEGADO]})
    if (intervalo.endsWith('A1:N1')) return Response.json({values:[CABECALHO_PLANILHA]})
    if (init?.method === 'PUT') {
      expect(u.searchParams.get('valueInputOption')).toBe('RAW')
      linha = JSON.parse(String(init.body)).values[0]
      escritas++
      if (incerto) throw new Error('Resposta perdida com token privado')
      return Response.json({updatedRows:1})
    }
    return Response.json({values:retornoErrado&&escritas?[['divergente']]:linha.length?[linha]:[]})
  }
  return {fetcher,linha:()=>linha,escritas:()=>escritas}
}
test('configuração ausente ou ID que tenta trocar o endpoint não habilita sincronização', () => {
  expect(configuracaoPlanilha({})).toBeNull()
  expect(configuracaoPlanilha({GOOGLE_PLANILHA_ID:'https://outro.test',GOOGLE_PLANILHA_ABA_ID:'123',GOOGLE_PLANILHA_CLIENT_EMAIL:config.email,GOOGLE_PLANILHA_PRIVATE_KEY:config.chave})).toBeNull()
})
test('grava critérios como texto RAW e só confirma depois de conferir os valores', async () => {
  const fake = provedor()
  const cliente = await criarClientePlanilha(config,fake.fetcher).conectar()
  await cliente.gravar(payload)
  expect(fake.linha()).toEqual([payload.pedido,'1',payload.dados.vendedor_id,'Vendedor teste','2026-10-22','quinta-feira','=IMPORTXML("x")','','São Paulo','SP','planejado','2026-10-22T10:00:00.000Z','1'])
})
test.each([{outraAba:true},{ocupado:true},{alterado:true}])('não escreve em aba ou conteúdo divergente: %j', async opcoes => {
  const fake = provedor(opcoes)
  const cliente = await criarClientePlanilha(config,fake.fetcher).conectar()
  await expect(cliente.gravar(payload)).rejects.toThrow('conferência')
  expect(fake.escritas()).toBe(0)
})
test('resposta incerta conserva uma única linha e pode ser reconciliada sem append', async () => {
  const fake = provedor({incerto:true})
  const cliente = await criarClientePlanilha(config,fake.fetcher).conectar()
  await expect(cliente.gravar(payload)).rejects.toThrow('confirmada')
  expect(fake.linha()).toEqual(celulasDoPedido(payload))
  await cliente.gravar(payload)
  expect(fake.escritas()).toBe(1)
})
test('leitura divergente depois da escrita não produz confirmação', async () => {
  const fake = provedor({retornoErrado:true})
  const cliente = await criarClientePlanilha(config,fake.fetcher).conectar()
  await expect(cliente.gravar(payload)).rejects.toThrow('conferência')
})
test('contrato novo acrescenta critérios canônicos na coluna N e mantém A:M', () => {
  const novo = { ...payload, dados: { ...payload.dados, criterios: { nota: 0, termos: '=IMPORTXML("x")', telefone: ['fixo'] } } }
  const celulas = celulasDoPedido(novo)
  expect(celulas).toHaveLength(14)
  expect(celulas.slice(0, 13)).toEqual(celulasDoPedido(payload))
  expect(JSON.parse(celulas[13])).toMatchObject({ nota: 0, termos: '=IMPORTXML("x")', telefone: ['fixo'], site: [] })
})
test('envia e confere 14 células como texto RAW na mesma linha', async () => {
  const p = { ...payload, dados: { ...payload.dados, criterios: { telefone: ['fixo'] } } }
  const fake = provedor()
  const cliente = await criarClientePlanilha(config, fake.fetcher).conectar()
  await cliente.gravar(p)
  expect(fake.linha()).toEqual(celulasDoPedido(p))
  expect(fake.linha()).toHaveLength(14)
})
test('estende linha legada na mesma posição depois de reconciliar versão anterior', async () => {
  const fake = provedor()
  const cliente = await criarClientePlanilha(config, fake.fetcher).conectar()
  await cliente.gravar(payload)
  const p = { ...payload, versao: 2, revisao: 2, anteriores: [celulasDoPedido(payload)], dados: { ...payload.dados, criterios: { nota: 4 } } }
  await cliente.gravar(p)
  expect(fake.linha()).toEqual(celulasDoPedido(p))
  expect(fake.escritas()).toBe(2)
})
