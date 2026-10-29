import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
import { gerarWorkflow, type WorkflowConfig, type WorkflowExport } from './workflow'
import { serializarAbas } from '../../lib/prospeccao-base/abas'
import { consolidar } from '../../lib/prospeccao-base/consolidar'
import type { FonteMaps, Base } from '../../lib/prospeccao-base/modelo'

const config: WorkflowConfig = {
  planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test', instancia: 'cenario',
  abas: { Empresas: 1, Telefones: 2, Coletas: 3 },
}
const fonte = (place_id: string): FonteMaps => ({
  place_id, nome_empresa: 'Cenário ' + place_id, cnpj: '', telefone: '(11) 2606-1244',
  endereco: 'Rua do cenário, 10', link_maps: 'https://maps.google.com/',
})
type Item = { json: Record<string, unknown>; binary?: Record<string, unknown> }
async function code(w: WorkflowExport, name: string, input: Item[], named: Record<string, Item[]> = {}, bytes?: Uint8Array, seguro = false, runIndex = 0) {
  const node = w.nodes.find(n => n.name === name)
  if (!node) throw new Error('Nó ausente: ' + name)
  const fn = runInNewContext((seguro ? 'Object.defineProperty = function(o){ return o };' : '') + '(async function(){' + String(node.parameters.jsCode) + '})', {
    $input: { all: () => input, first: () => input[0] }, $json: input[0]?.json,
    $execution: { id: 'exec-teste' }, $runIndex: runIndex, Date, TextDecoder,
    $: (nome: string) => ({
      all: () => named[nome] ?? [], first: () => named[nome]?.[0], item: named[nome]?.[0],
    }),
  })
  return await fn.call({ helpers: { getBinaryDataBuffer: async () => bytes } }) as Item[]
}
test('workflow manual só consulta registro e não exporta credenciais', () => {
  const w = gerarWorkflow(config)
  const json = JSON.stringify(w)
  expect(json).not.toContain('/message/')
  expect(json).not.toContain('credentials')
  expect(json).not.toContain('pinData')
  expect(w.settings).not.toHaveProperty('concurrency')
  expect(w.nodes.some(n => n.type === 'n8n-nodes-base.formTrigger')).toBe(true)
})
test('leitura seguinte recebe um item de controle e não repete a consulta por empresa', async () => {
  const w = gerarWorkflow(config)
  expect(await code(w, 'Controlar leitura Telefones', Array.from({ length: 45 }, () => ({ json: {} }))))
    .toHaveLength(1)
})
async function plano(base: Base, fontes: FonteMaps[]) {
  const w = gerarWorkflow(config)
  const abas = serializarAbas(base)
  const named: Record<string, Item[]> = {
    'Criar hash coleta': [{ json: { fontes, coleta_hash: 'a'.repeat(64), fonte: 'Google Maps', regiao: 'Mooca', termos: ['CFTV'],
      arquivo: 'cenario.csv', data: '2026-10-14', execucaoId: 'exec-teste' } }],
    'Ler Empresas': abas.Empresas.map(json => ({ json })),
    'Ler Telefones': abas.Telefones.map(json => ({ json })),
    'Ler Coletas': abas.Coletas.map(json => ({ json })),
  }
  const out = await code(w, 'Consolidar dados', [{ json: {} }], named)
  return { w, out, named }
}
test('novo telefone compartilhado conserva duas empresas e consulta única', async () => {
  const { out } = await plano({ empresas: [], telefones: [], coletas: [] }, [fonte('p1'), fonte('p2')])
  const p = out[0].json as { base: Base; lotes: { numeros: string[] }[] }
  expect(p.base.empresas).toHaveLength(2)
  expect(p.base.telefones).toHaveLength(1)
  expect(p.lotes).toEqual([{ numeros: ['551126061244'] }])
})
test('lista já validada chega ao relatório sem reconsultar os números', async () => {
  const r = consolidar({ empresas: [], telefones: [], coletas: [] }, [fonte('p1')], {
    id: 'a'.repeat(64), sha256: 'a'.repeat(64), execucaoId: 'antiga', fonte: 'Maps',
    regiao: 'Mooca', termos: [], data: '2026-10-14', arquivo: 'cenario.csv',
  })
  if (!r.ok) throw new Error(r.motivo)
  r.base.telefones[0].estado = 'encontrado'
  const { w, out } = await plano(r.base, [fonte('p1')])
  expect(out[0].json.lotes).toEqual([])
  const lotes = await code(w, 'Preparar lotes', out, { 'Consolidar dados': out })
  expect(lotes).toEqual([{ json: { _vazio: true } }])
})
test('lotes de números novos não ultrapassam dez', async () => {
  const fontes = Array.from({ length: 23 }, (_, i) => ({ ...fonte('p' + i), telefone: '11' + String(26060000 + i) }))
  const { out } = await plano({ empresas: [], telefones: [], coletas: [] }, fontes)
  expect((out[0].json.lotes as { numeros: string[] }[]).map(l => l.numeros.length)).toEqual([10, 10, 3])
})
test('releitura duplicada bloqueia relatório de sucesso', async () => {
  const { w, out } = await plano({ empresas: [], telefones: [], coletas: [] }, [fonte('p1')])
  const abas = serializarAbas(out[0].json.base as Base)
  const named: Record<string, Item[]> = { 'Consolidar dados': out,
    'Conferir Empresas': abas.Empresas.map(json => ({ json })),
    'Conferir Telefones': [...abas.Telefones, ...abas.Telefones].map(json => ({ json })),
    'Conferir Coletas': abas.Coletas.map(json => ({ json })),
  }
  await expect(code(w, 'Relatorio final', [{ json: {} }], named)).rejects.toThrow('base_invalida')
})
test('falha de escrita interrompe o grafo, sem caminho de continuar para sucesso', () => {
  const w = gerarWorkflow(config)
  for (const n of w.nodes.filter(n => n.type === 'n8n-nodes-base.googleSheets' && n.parameters.operation === 'appendOrUpdate')) {
    expect(n.onError ?? 'stopWorkflow').toBe('stopWorkflow')
  }
})

test('classificação no Code node conserva vínculos e erro não vira negativo', async () => {
  const { w, out } = await plano({ empresas: [], telefones: [], coletas: [] }, [fonte('p1'), fonte('p2')])
  const named: Record<string, Item[]> = {
    'Consolidar dados': out,
    'Loop lotes': [{ json: { numeros: ['551126061244'] } }],
    'Verificar conexao': [{ json: { statusCode: 200, body: { instance: { state: 'open' } } } }],
  }
  const r = await code(w, 'Classificar consulta', [{ json: { statusCode: 429, body: [] } }], named)
  expect(r[0].json.whatsapp).toBe('inconclusivo')
  expect(JSON.parse(String(r[0].json.empresas_ids))).toEqual(['google:p1', 'google:p2'])
})
test('validação do upload recusa cabeçalhos duplicados antes de acessar planilha', async () => {
  const w = gerarWorkflow(config)
  const bytes = new TextEncoder().encode('place_id,place_id\np1,p2\n')
  await expect(code(w, 'Validar arquivo', [{ json: {}, binary: { csv: {} } }], {}, bytes))
    .rejects.toThrow('Cabecalho invalido')
})
test('validação do upload recusa UTF-8 inválido', async () => {
  const w = gerarWorkflow(config)
  await expect(code(w, 'Validar arquivo', [{ json: {}, binary: { csv: {} } }], {}, new Uint8Array([0xff])))
    .rejects.toThrow()
})

test('entrypoint funciona com Object.defineProperty neutralizado pelo runner seguro', async () => {
  const w = gerarWorkflow(config)
  const named = { 'Receber CSV': [{ json: { fonte: 'Maps', regiao: 'Mooca', termos: 'CFTV' } }] }
  const resultado = await code(w, 'Preparar coleta', [{ json: fonte('p1') }], named, undefined, true)
  expect(resultado[0].json.fontes).toEqual([fonte('p1')])
})

function conferir(base: Base, out: Item[], validacoes: Item[] = []) {
  const abas = serializarAbas(base)
  return {
    'Consolidar dados': out,
    'Controlar conferência final': [{ json: { validacoes: validacoes.map(i => i.json) } }],
    'Conferir Empresas': abas.Empresas.map(json => ({ json })),
    'Conferir Telefones': abas.Telefones.map(json => ({ json })),
    'Conferir Coletas': abas.Coletas.map(json => ({ json })),
  }
}

test('relatório recusa endereço antigo mesmo com chaves e JSON consistentes', async () => {
  const { w, out } = await plano({ empresas: [], telefones: [], coletas: [] }, [fonte('p1')])
  const antigo = structuredClone(out[0].json.base as Base)
  antigo.empresas[0].publicados.endereco = 'Endereço anterior'
  await expect(code(w, 'Relatorio final', [], conferir(antigo, out)))
    .rejects.toThrow('Gravacao incompleta')
})

test('relatório recusa validação antiga após resultado encontrado', async () => {
  const { w, out } = await plano({ empresas: [], telefones: [], coletas: [] }, [fonte('p1')])
  const base = out[0].json.base as Base
  const rows = serializarAbas(base).Telefones.map(l => ({ json: { ...l, whatsapp: 'encontrado' } }))
  await expect(code(w, 'Relatorio final', [], conferir(base, out, rows)))
    .rejects.toThrow('Gravacao incompleta')
})

test('relatório exige o resultado de todos os lotes, mesmo se planilha ainda está pendente', async () => {
  const { w, out } = await plano({ empresas: [], telefones: [], coletas: [] }, [fonte('p1')])
  await expect(code(w, 'Relatorio final', [], conferir(out[0].json.base as Base, out)))
    .rejects.toThrow('Validacao incompleta')
})

test('resultado esperado de cada lote vem da classificação, não do retorno da escrita', async () => {
  const w = gerarWorkflow(config)
  const rows = [{ json: { numero: '551126061244', whatsapp: 'encontrado' } }]
  expect(await code(w, 'Guardar resultado lote', [{ json: { whatsapp: 'pendente' } }],
    { 'Classificar consulta': rows })).toEqual(rows)
  expect((w.connections['Atualizar validacao'] as { main: unknown[][] }).main[0])
    .toContainEqual({ node: 'Guardar resultado lote', type: 'main', index: 0 })
  const controle = await code(w, 'Controlar conferência final', rows)
  expect(controle[0].json.validacoes).toEqual(rows.map(r => r.json))
})

test('conferência fiel aceita os resultados combinados de dois lotes', async () => {
  const fontes = Array.from({ length: 11 }, (_, i) => ({ ...fonte('p' + i), telefone: '11' + String(26060000 + i) }))
  const { w, out } = await plano({ empresas: [], telefones: [], coletas: [] }, fontes)
  const base = structuredClone(out[0].json.base as Base)
  for (const t of base.telefones) t.estado = 'encontrado'
  const rows = serializarAbas(base).Telefones.map(json => ({ json }))
  const resultado = await code(w, 'Relatorio final', [], conferir(base, out, rows))
  expect(resultado[0].json.encontrado).toBe(11)
})


test('export usa Extract 1.1 suportado pelo n8n 2.36.8', () => {
  const w=gerarWorkflow(config)
  expect(w.nodes.find(n=>n.name==='Extrair CSV')).toMatchObject({ type:'n8n-nodes-base.extractFromFile',typeVersion:1.1,parameters:{operation:'csv'} })
  expect((w.connections['Validar arquivo'] as {main:unknown[][]}).main[0]).toContainEqual({node:'Extrair CSV',type:'main',index:0})
  expect((w.connections['Extrair CSV'] as {main:unknown[][]}).main[0]).toContainEqual({node:'Preparar coleta',type:'main',index:0})
})

test('consulta e nova tentativa usam o nó comunitário com números originais', () => {
  const w=gerarWorkflow(config)
  for (const nome of ['Consultar WhatsApp','Consultar novamente']) {
    expect(w.nodes.find(n=>n.name===nome)).toMatchObject({ type:'n8n-nodes-evolution-api.evolutionApi',typeVersion:1,
      parameters:{resource:'chat-api',operation:'check-number',instanceName:'cenario',numbers:'={{ $("Loop lotes").item.json.numeros.join(",") }}'},
      onError:'continueRegularOutput' })
  }
  expect(w.nodes.find(n=>n.name==='Verificar conexao')).toMatchObject({ type:'n8n-nodes-base.httpRequest',parameters:{
    authentication:'predefinedCredentialType',nodeCredentialType:'evolutionApi',url:'https://evolution.test/instance/connectionState/cenario' } })
  expect(w.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest')).toHaveLength(1)
  const repetir=w.nodes.find(n=>n.name==='Repetir consulta')!
  expect(JSON.stringify(repetir.parameters)).toContain('$json.success !== true')
})

test('retorno success/data é classificado sem perder vínculos de telefone fixo', async () => {
  const {w,out}=await plano({empresas:[],telefones:[],coletas:[]},[fonte('p1'),fonte('p2')])
  const named={ 'Consolidar dados':out,'Loop lotes':[{json:{numeros:['551126061244']}}],
    'Verificar conexao':[{json:{statusCode:200,body:{instance:{state:'open'}}}}] }
  const [r]=await code(w,'Classificar consulta',[{json:{success:true,data:[{number:'551126061244',exists:true,jid:'551126061244@s.whatsapp.net'}]}}],named)
  expect(r.json.whatsapp).toBe('encontrado')
  expect(r.json.numero).toBe('551126061244')
  expect(r.json.http).toBe('')
  expect(JSON.parse(String(r.json.empresas_ids))).toEqual(['google:p1','google:p2'])
})

test('instância com caracteres de URL permanece um único segmento na comunidade', () => {
  const w=gerarWorkflow({...config,instancia:'nome /&?'})
  expect(w.nodes.find(n=>n.name==='Consultar WhatsApp')?.parameters.instanceName).toBe('nome%20%2F%26%3F')
})
