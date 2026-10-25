import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
import { CABECALHO_PLANILHA } from './cliente'

type No = { name: string; type: string; parameters: Record<string, unknown>; credentials?: unknown }
type Fluxo = { active: boolean; settings: Record<string, unknown>; nodes: No[]; connections: Record<string, {main: Array<Array<{node:string}>>}> }
const planilha = '17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU'
const pedido = '00000000-0000-4000-8000-000000000001'
const envio = '00000000-0000-4000-8000-000000000003'
const celulas = [pedido,'3','00000000-0000-4000-8000-000000000002','Fictício','2026-10-26','segunda-feira','=IMPORTXML("literal")','','São Paulo','SP','planejado','2026-10-25T15:00:00Z','2','{"telefone":["fixo"]}']
const entrada = () => ({ protocolo:1,operacao:'sincronizar',planilha_id:planilha,aba_id:10151006,pedido_id:pedido,envio_id:envio,linha:2,revisao:3,versao:2,celulas:[...celulas],anteriores:[] as string[][] })
const ler = async () => JSON.parse(await readFile('workflows/n8n/google/verificar-empresas.json','utf8')) as Fluxo
async function executar(body: Record<string,unknown>, op: { existente?:string[]; header?:string[]; rowCount?:number; retornoDivergente?:boolean; planilhaDivergente?:boolean } = {}) {
  const fluxo = await ler()
  let nome = 'Receber planejamento'
  let atual: Record<string,unknown> = {body}
  const memoria = new Map<string,Record<string,unknown>>()
  const chamadas: {method:string;url:string;body?:Record<string,unknown>}[] = []
  let linha = op.existente ?? []
  let tamanho = op.rowCount ?? 1000
  let escritas = 0
  const contexto = () => ({ $json:atual, $input:{first:()=>({json:atual}),all:()=>[{json:atual}]}, $:(n:string)=>({first:()=>({json:memoria.get(n)})}), JSON,Date,URL,encodeURIComponent,Buffer })
  const expr = (v:unknown):unknown => typeof v==='string' && v.startsWith('={{') ? runInNewContext(v.slice(3,-2),contexto()) : v
  for (let passo=0;passo<80;passo++) {
    const no = fluxo.nodes.find(n=>n.name===nome)
    expect(no,'ramo de planejamento precisa existir no workflow único').toBeDefined()
    let saida = 0
    if(no!.type==='n8n-nodes-base.code') {
      const itens = runInNewContext('(function(){'+no!.parameters.jsCode+'})()',contexto()) as {json:Record<string,unknown>}[]
      atual = JSON.parse(JSON.stringify(itens[0].json))
    } else if(no!.type==='n8n-nodes-base.if') {
      const c = no!.parameters.conditions as {conditions:{leftValue:unknown}[]}
      saida = expr(c.conditions[0].leftValue) ? 0 : 1
    } else if(no!.type==='n8n-nodes-base.httpRequest') {
      expect(no!.parameters.authentication).toBe('predefinedCredentialType')
      expect(no!.parameters.nodeCredentialType).toBe('googleSheetsOAuth2Api')
      const method = String(no!.parameters.method ?? 'GET')
      const url = String(expr(no!.parameters.url))
      const requestBody = no!.parameters.jsonBody ? expr(no!.parameters.jsonBody) : undefined
      const b = typeof requestBody==='string' ? JSON.parse(requestBody) : requestBody
      chamadas.push({method,url,body:b as Record<string,unknown>|undefined})
      const u = new URL(url)
      expect(u.origin).toBe('https://sheets.googleapis.com')
      expect(u.pathname).toContain('/spreadsheets/'+planilha)
      if(u.pathname.endsWith(':batchUpdate')) {
        const req = (b as {requests:{appendDimension:{length:number}}[]}).requests[0]
        tamanho += req.appendDimension.length
        atual = {}
      } else if(!u.pathname.includes('/values/')) {
        atual = {spreadsheetId:op.planilhaDivergente?'outro':planilha,sheets:[{properties:{sheetId:10151006,title:'Planejamento CRM',gridProperties:{rowCount:tamanho,columnCount:14}}}]}
      } else {
        const range = decodeURIComponent(u.pathname.split('/values/')[1])
        if(range.endsWith('A1:N1')) atual = {values:[op.header ?? CABECALHO_PLANILHA]}
        else {
          if(method==='PUT') {
            expect(u.searchParams.get('valueInputOption')).toBe('RAW')
            linha = (b as {values:string[][]}).values[0]
            escritas++
            atual = {updatedRows:1}
          } else atual = {values:op.retornoDivergente&&escritas?[['divergente']]:linha.length?[linha]:[]}
        }
      }
    } else if(no!.type==='n8n-nodes-base.respondToWebhook') {
      const retorno = expr(no!.parameters.responseBody)
      return {retorno:typeof retorno==='string'?JSON.parse(retorno):retorno,chamadas,linha,escritas,tamanho}
    }
    memoria.set(nome,atual)
    const proximo = fluxo.connections[nome]?.main[saida]?.[0]?.node
    if(!proximo) throw new Error('Grafo sem resposta: '+nome)
    nome = proximo
  }
  throw new Error('Grafo não encerrou')
}

test('o mesmo workflow tem ramo de planilha autenticado e não guarda dados de execução',async()=>{
  const f=await ler()
  expect(f.active).toBe(false)
  expect(f.nodes.filter(n=>n.type==='n8n-nodes-base.webhook')).toHaveLength(2)
  expect(f.nodes.filter(n=>n.type==='n8n-nodes-base.webhook').every(n=>n.parameters.authentication==='headerAuth')).toBe(true)
  expect(f.settings).toMatchObject({saveDataErrorExecution:'none',saveDataSuccessExecution:'none',saveManualExecutions:false})
  expect(f.nodes.every(n=>n.credentials===undefined)).toBe(true)
})
test('conferência lê somente metadados/cabeçalho e não insere pedidos fictícios',async()=>{
  const r=await executar({protocolo:1,operacao:'conferir',planilha_id:planilha,aba_id:10151006})
  expect(r.chamadas.map(c=>c.method)).toEqual(['GET','GET'])
  expect(r.escritas).toBe(0)
  expect(r.retorno).toMatchObject({estado:'conferido',planilha_id:planilha,aba_id:10151006,cabecalho:CABECALHO_PLANILHA})
})
test('grava texto RAW, relê a mesma linha e retorna as identidades exatas',async()=>{
  const r=await executar(entrada())
  expect(r.linha).toEqual(celulas)
  expect(r.escritas).toBe(1)
  expect(r.chamadas.map(c=>c.method)).toEqual(['GET','GET','GET','PUT','GET'])
  expect(r.retorno).toMatchObject({protocolo:1,estado:'sincronizado',pedido_id:pedido,envio_id:envio,linha:2,revisao:3,versao:2,planilha_id:planilha,aba_id:10151006,celulas})
})
test('repetir conteúdo idêntico só lê; revisão seguinte aceita a intenção anterior conhecida',async()=>{
  const a=await executar(entrada(),{existente:[...celulas]})
  expect(a.escritas).toBe(0)
  const anterior=[...celulas];anterior[1]='2';anterior[12]='1';anterior[6]='Nicho anterior'
  const b=await executar({...entrada(),anteriores:[anterior]},{existente:anterior})
  expect(b.escritas).toBe(1)
  expect(b.linha[6]).toBe('=IMPORTXML("literal")')
})
test.each([
  {planilha_id:'outro'}, {aba_id:123}, {linha:1}, {envio_id:'invalido'},
  {celulas:[...celulas.slice(0,12),'999',celulas[13]]},
  {anteriores:[['pedido-alheio',...celulas.slice(1)]]},
])('bloqueia entrada que não pertence à identidade/destino: %j',async alteracao=>{
  await expect(executar({...entrada(),...alteracao})).rejects.toThrow()
})
test.each([
  {header:['Cabeçalho estranho']}, {existente:['linha manual']}, {planilhaDivergente:true},
])('bloqueia divergências no destino sem confirmar: %j',async op=>{
  await expect(executar(entrada(),op)).rejects.toThrow()
})
test('não confirma leitura divergente após PUT',async()=>{
  await expect(executar(entrada(),{retornoDivergente:true})).rejects.toThrow()
})
test('mantém o contrato de 13 células das intenções legadas',async()=>{
  const r=await executar({...entrada(),celulas:celulas.slice(0,13)})
  expect(r.linha).toHaveLength(13)
  expect(r.retorno.celulas).toEqual(celulas.slice(0,13))
})
test('expande apenas o fim da grade para linha alocada além da capacidade',async()=>{
  const r=await executar({...entrada(),linha:1002},{rowCount:1000})
  expect(r.tamanho).toBe(1002)
  expect(r.chamadas.filter(c=>c.method==='POST')).toHaveLength(1)
  expect(r.escritas).toBe(1)
})
