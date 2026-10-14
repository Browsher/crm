import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CABECALHOS_ABAS } from '../../lib/prospeccao-base/abas'
import { compilarCodigoN8n } from './codigo-n8n'

export type WorkflowConfig = {
  planilhaId: string
  evolutionUrl: string
  instancia: string
  abas: { Empresas: number; Telefones: number; Coletas: number }
}
export type WorkflowNode = {
  id: string; name: string; type: string; typeVersion: number; position: [number, number]
  parameters: Record<string, unknown>; [key: string]: unknown
}
export type WorkflowExport = {
  name: string; nodes: WorkflowNode[]; connections: Record<string, unknown>; settings: Record<string, unknown>
}
type Aba = keyof typeof CABECALHOS_ABAS
type Ligacao = { node: string; type: 'main'; index: number }
let codigoBiblioteca: string | null = null
function biblioteca() {
  if (codigoBiblioteca !== null) return codigoBiblioteca
  const arquivos = ['src/lib/cnpj', 'src/lib/prospeccao-base/modelo', 'src/lib/prospeccao-base/telefone',
    'src/lib/prospeccao-base/consolidar', 'src/lib/prospeccao-base/abas', 'src/lib/prospeccao-base/whatsapp',
    'src/server/prospeccao-base/entrada']
  const modulos = Object.fromEntries(arquivos.map(p => [p, readFileSync(resolve(p + '.ts'), 'utf8')]))
  modulos.entry = [
    "export * from './src/lib/prospeccao-base/consolidar'",
    "export * from './src/lib/prospeccao-base/abas'",
    "export * from './src/lib/prospeccao-base/whatsapp'",
    "export * from './src/server/prospeccao-base/entrada'",
  ].join('\n')
  codigoBiblioteca = compilarCodigoN8n(modulos, 'entry')
  return codigoBiblioteca
}
export function gerarWorkflow(config: WorkflowConfig): WorkflowExport {
  const url = new URL(config.evolutionUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    !config.planilhaId || !config.instancia || Object.values(config.abas).some(v => !Number.isSafeInteger(v) || v < 0)) {
    throw new Error('Configuração inválida')
  }
  const nodes: WorkflowNode[] = []
  const connections: Record<string, { main: Ligacao[][] }> = {}
  const add = (name: string, type: string, typeVersion: number, parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    nodes.push({ id: 'crm-base-' + (nodes.length + 1), name, type: 'n8n-nodes-base.' + type,
      typeVersion, position: [(nodes.length % 8) * 280, Math.floor(nodes.length / 8) * 260],
      parameters, ...extra })
  }
  const ligar = (de: string, para: string, saida = 0) => {
    connections[de] ??= { main: [] }
    connections[de].main[saida] ??= []
    connections[de].main[saida].push({ node: para, type: 'main', index: 0 })
  }
  const code = (name: string, body: string, lib = false) =>
    add(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: (lib ? 'const lib = ' + biblioteca() + ';\n' : '') + body })
  const controlar = (name: string) => code(name, 'return [{json:{}}]')
  const condicao = (name: string, expression: string) => add(name, 'if', 2.2, {
    conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{ id: 'condicao', leftValue: expression, rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' },
  })
  const sheet = (name: string, aba: Aba, gravar = false) => add(name, 'googleSheets', 4.6, {
    resource: 'sheet', operation: gravar ? 'appendOrUpdate' : 'read',
    documentId: { __rl: true, value: config.planilhaId, mode: 'id' },
    sheetName: { __rl: true, value: 'gid=' + config.abas[aba], mode: 'list', cachedResultName: aba },
    ...(gravar ? {
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [aba === 'Empresas' ? 'id' : aba === 'Telefones' ? 'numero' : 'chave'],
        schema: CABECALHOS_ABAS[aba].map(id => ({ id, displayName: id, required: false, defaultMatch: false,
          display: true, type: id === 'quantidade_empresas' ? 'number' : 'string', canBeUsedToMatch: true })) },
      options: { cellFormat: 'RAW', handlingExtraData: 'error', useAppend: false },
    } : { options: { returnFirstMatch: false } }),
  }, { alwaysOutputData: true, onError: 'stopWorkflow' })
  const http = (name: string, path: string, post = false) => add(name, 'httpRequest', 4.2, {
    method: post ? 'POST' : 'GET',
    url: config.evolutionUrl.replace(/\/$/, '') + path + encodeURIComponent(config.instancia),
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    ...(post ? { sendBody: true, specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ numbers: $("Loop lotes").item.json.numeros }) }}' } : {}),
    options: { timeout: 15000, redirect: { redirect: { followRedirects: false } }, response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } },
  }, { onError: 'continueRegularOutput' })

  add('Receber CSV', 'formTrigger', 2.2, {
    authentication: 'basicAuth', formTitle: 'Importar coleta Google Maps', responseMode: 'lastNode',
    formFields: { values: [
      { fieldLabel: 'csv', fieldType: 'file', acceptFileTypes: '.csv', multipleFiles: false, requiredField: true },
      { fieldLabel: 'regiao', fieldType: 'text', requiredField: true },
      { fieldLabel: 'termos', fieldType: 'textarea', requiredField: true },
      { fieldLabel: 'fonte', fieldType: 'text', defaultValue: 'Google Maps', requiredField: true },
    ] }, options: { path: 'crm-base-prospeccao', buttonLabel: 'Importar coleta', useWorkflowTimezone: true },
  }, { webhookId: 'crm-base-prospeccao' })
  code('Validar arquivo', String.raw`
const itens = $input.all()
if (itens.length !== 1 || !itens[0].binary?.csv) throw new Error('Selecione um CSV')
const bytes = await this.helpers.getBinaryDataBuffer(0,'csv')
if (bytes.length > 1500000) throw new Error('CSV excede 1500000 bytes')
const texto = new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'')
const header = texto.split(/\r?\n/,1)[0].split(',').map(c => c.replace(/^"|"$/g,''))
if (!header.length || new Set(header).size !== header.length ||
  header.some(c => !/^[a-z][a-z0-9_]*$/.test(c))) throw new Error('Cabecalho invalido ou repetido')
return itens
`)
  add('Extrair CSV', 'extractFromFile', 1.2, { operation: 'csv', binaryPropertyName: 'csv',
    options: { encoding: 'utf8', delimiter: ',', enableBOM: true, headerRow: true, includeEmptyCells: true,
      maxRowCount: -1, relaxQuotes: false } }, { alwaysOutputData: true })
  code('Preparar coleta', String.raw`
const fontes = $input.all().map(i => i.json)
const r = lib.lerFontesMaps(fontes)
if (!r.ok || r.fontes.length === 0 || r.fontes.length > 5000) throw new Error('entrada_invalida')
const form = $('Receber CSV').first().json
const nome = form.csv?.filename ?? form.csv?.fileName ?? 'coleta.csv'
return [{json:{fontes:r.fontes, payloadHash:JSON.stringify(r.fontes),
  execucaoId:'n8n:' + $execution.id, fonte:String(form.fonte ?? 'Google Maps'),
  regiao:String(form.regiao ?? ''), termos:String(form.termos ?? '').split(/\r?\n/).filter(Boolean),
  arquivo:String(nome).split(/[\\/]/).pop(), data:r.fontes[0].data_coleta ?? new Date().toISOString()}}]
`, true)
  add('Criar hash coleta', 'crypto', 1, { action: 'hash', type: 'SHA256', value: '={{ $json.payloadHash }}',
    dataPropertyName: 'coleta_hash', encoding: 'hex', binaryData: false })
  sheet('Ler Empresas', 'Empresas')
  controlar('Controlar leitura Telefones')
  sheet('Ler Telefones', 'Telefones')
  controlar('Controlar leitura Coletas')
  sheet('Ler Coletas', 'Coletas')
  code('Consolidar dados', String.raw`
const aba = (nome,headers) => $(nome).all().map(i => i.json).filter(r => Object.keys(r).length > 0)
  .map(r => Object.fromEntries(headers.map(h => [h,r[h] ?? ''])))
const antiga = lib.desserializarAbas({
  Empresas:aba('Ler Empresas',lib.CABECALHOS_ABAS.Empresas),
  Telefones:aba('Ler Telefones',lib.CABECALHOS_ABAS.Telefones),
  Coletas:aba('Ler Coletas',lib.CABECALHOS_ABAS.Coletas)})
if (!antiga.ok) throw new Error(antiga.motivo)
const entrada = $('Criar hash coleta').first().json
const coleta = {id:entrada.coleta_hash,sha256:entrada.coleta_hash,execucaoId:entrada.execucaoId,
  fonte:entrada.fonte,regiao:entrada.regiao,termos:entrada.termos,data:entrada.data,arquivo:entrada.arquivo}
const r = lib.consolidar(antiga.base,entrada.fontes,coleta)
if (!r.ok) throw new Error(r.motivo)
const abas = lib.serializarAbas(r.base)
const antes = lib.serializarAbas(antiga.base)
const escritas = {}
for (const nome of ['Empresas','Telefones','Coletas']) {
  const key = nome === 'Empresas' ? 'id' : nome === 'Telefones' ? 'numero' : 'chave'
  const mapa = new Map(antes[nome].map(l => [l[key],JSON.stringify(l)]))
  escritas[nome] = abas[nome].filter(l => mapa.get(l[key]) !== JSON.stringify(l))
}
const numeros = r.base.telefones.filter(lib.precisaConsultar).map(t => t.numero)
const lotes = []
for (let i=0;i<numeros.length;i+=10) lotes.push({numeros:numeros.slice(i,i+10)})
return [{json:{base:r.base,escritas,lotes,pendencias:r.pendencias,coleta}}]
`, true)
  for (const aba of ['Empresas', 'Telefones', 'Coletas'] as const) {
    code('Linhas ' + aba, 'const linhas = $("Consolidar dados").first().json.escritas.' + aba + '\n' +
      'return linhas.length ? linhas.map(l => ({json:' + (aba === 'Telefones' ? '{...l,quantidade_empresas:Number(l.quantidade_empresas)}' : 'l') + '})) : [{json:{_vazio:true}}]')
    condicao('Ha linhas ' + aba, '={{ !$json._vazio }}')
    sheet('Gravar ' + aba, aba, true)
  }
  code('Preparar lotes', 'const lotes = $("Consolidar dados").first().json.lotes\nreturn lotes.length ? lotes.map(json => ({json})) : [{json:{_vazio:true}}]')
  condicao('Ha lotes', '={{ !$json._vazio }}')
  add('Loop lotes', 'splitInBatches', 3, { batchSize: 1, options: {} })
  http('Verificar conexao', '/instance/connectionState/')
  condicao('Instancia conectada', '={{ $json.statusCode >= 200 && $json.statusCode < 300 && $json.body?.instance?.state === "open" }}')
  http('Consultar WhatsApp', '/chat/whatsappNumbers/', true)
  condicao('Repetir consulta', '={{ !!$json.error || $json.statusCode === 429 || $json.statusCode >= 500 }}')
  add('Esperar tentativa', 'wait', 1.1, { resume: 'timeInterval', amount: 2, unit: 'seconds' })
  http('Consultar novamente', '/chat/whatsappNumbers/', true)
  code('Classificar consulta', String.raw`
const lote = $('Loop lotes').item.json
const input = $input.first().json
const conexao = $('Verificar conexao').item.json
const conectado = conexao.statusCode >= 200 && conexao.statusCode < 300 && conexao.body?.instance?.state === 'open'
const resposta = {statusHTTP:typeof input.statusCode === 'number' ? input.statusCode : null,
  corpo:conectado ? input.body : null, conectado, falha:input.error ? 'erro_transporte' : null}
const classificados = lib.classificarConsulta(lote.numeros,resposta,new Date().toISOString())
const base = $('Consolidar dados').first().json.base
const porNumero = new Map(base.telefones.map(t => [t.numero,t]))
const atualizados = classificados.map(r => {
  const anterior = porNumero.get(r.numero)
  if (!anterior) throw new Error('Numero sem associacao')
  return {...anterior,estado:r.estado,numeroRetornado:r.numeroRetornado,jid:r.jid,
    verificadoEm:r.verificadoEm,statusHTTP:r.statusHTTP,motivo:r.motivo,revalidar:false}
})
const rows = lib.serializarAbas({empresas:[],telefones:atualizados,coletas:[]}).Telefones
return rows.map(l => ({json:{...l,quantidade_empresas:Number(l.quantidade_empresas)}}))
`, true)
  sheet('Atualizar validacao', 'Telefones', true)
  add('Intervalo lote', 'wait', 1.1, { resume: 'timeInterval', amount: 0.75, unit: 'seconds' })
  controlar('Controlar conferência final')
  sheet('Conferir Empresas', 'Empresas')
  controlar('Controlar conferência Telefones')
  sheet('Conferir Telefones', 'Telefones')
  controlar('Controlar conferência Coletas')
  sheet('Conferir Coletas', 'Coletas')
  code('Relatorio final', String.raw`
const aba = (nome,headers) => $(nome).all().map(i => i.json).filter(r => Object.keys(r).length > 0)
  .map(r => Object.fromEntries(headers.map(h => [h,r[h] ?? ''])))
const r = lib.desserializarAbas({
  Empresas:aba('Conferir Empresas',lib.CABECALHOS_ABAS.Empresas),
  Telefones:aba('Conferir Telefones',lib.CABECALHOS_ABAS.Telefones),
  Coletas:aba('Conferir Coletas',lib.CABECALHOS_ABAS.Coletas)})
if (!r.ok) throw new Error(r.motivo)
const plano = $('Consolidar dados').first().json
for (const nome of ['empresas','telefones','coletas']) {
  const key = nome === 'empresas' ? 'id' : nome === 'telefones' ? 'numero' : 'chave'
  const existentes = new Set(r.base[nome].map(l => l[key]))
  if (plano.base[nome].some(l => !existentes.has(l[key]))) throw new Error('Gravacao incompleta')
}
const t = r.base.telefones
return [{json:{empresas:r.base.empresas.length,telefonesUnicos:t.length,
  empresasSemTelefone:r.base.empresas.filter(e => !e.telefoneNormalizado).length,
  encontrado:t.filter(t => t.estado === 'encontrado').length,
  nao_encontrado:t.filter(t => t.estado === 'nao_encontrado').length,
  inconclusivo:t.filter(t => t.estado === 'inconclusivo').length,
  pendente:t.filter(t => t.estado === 'pendente').length,
  pendencias:plano.pendencias,coleta:plano.coleta.id,mensagensEnviadas:0}}]
`, true)

  const inicio = ['Receber CSV', 'Validar arquivo', 'Extrair CSV', 'Preparar coleta', 'Criar hash coleta',
    'Ler Empresas', 'Controlar leitura Telefones', 'Ler Telefones', 'Controlar leitura Coletas', 'Ler Coletas', 'Consolidar dados', 'Linhas Empresas']
  for (let i = 0; i < inicio.length - 1; i++) ligar(inicio[i], inicio[i + 1])
  for (const [i, aba] of (['Empresas', 'Telefones', 'Coletas'] as const).entries()) {
    const proximo = i === 2 ? 'Preparar lotes' : 'Linhas ' + (i === 0 ? 'Telefones' : 'Coletas')
    ligar('Linhas ' + aba, 'Ha linhas ' + aba)
    ligar('Ha linhas ' + aba, 'Gravar ' + aba, 0)
    ligar('Ha linhas ' + aba, proximo, 1)
    ligar('Gravar ' + aba, proximo)
  }
  ligar('Preparar lotes', 'Ha lotes')
  ligar('Ha lotes', 'Loop lotes', 0)
  ligar('Ha lotes', 'Controlar conferência final', 1)
  ligar('Loop lotes', 'Controlar conferência final', 0)
  ligar('Loop lotes', 'Verificar conexao', 1)
  ligar('Verificar conexao', 'Instancia conectada')
  ligar('Instancia conectada', 'Consultar WhatsApp', 0)
  ligar('Instancia conectada', 'Classificar consulta', 1)
  ligar('Consultar WhatsApp', 'Repetir consulta')
  ligar('Repetir consulta', 'Esperar tentativa', 0)
  ligar('Repetir consulta', 'Classificar consulta', 1)
  ligar('Esperar tentativa', 'Consultar novamente')
  ligar('Consultar novamente', 'Classificar consulta')
  ligar('Classificar consulta', 'Atualizar validacao')
  ligar('Atualizar validacao', 'Intervalo lote')
  ligar('Intervalo lote', 'Loop lotes')
  const final = ['Controlar conferência final', 'Conferir Empresas', 'Controlar conferência Telefones',
    'Conferir Telefones', 'Controlar conferência Coletas', 'Conferir Coletas', 'Relatorio final']
  for (let i = 0; i < final.length - 1; i++) ligar(final[i], final[i + 1])
  return { name: 'CRM Prospecção Base Google Maps e WhatsApp', nodes, connections, settings: {
    executionOrder: 'v1', timezone: 'America/Sao_Paulo', saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false,
  } }
}
