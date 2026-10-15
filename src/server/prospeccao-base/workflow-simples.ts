import { compilarBibliotecaSimples } from './codigo-simples'
import type { WorkflowExport, WorkflowNode } from './workflow'

export type WorkflowSimplesConfig = {
  planilhaId: string
  evolutionUrl: string
  instancia: string
  abas: { origem: number; validacao: number; exportacao: number }
}

type Ligacao = { node: string; type: 'main'; index: number }

function validarConfig(config: WorkflowSimplesConfig): void {
  try {
    const url = new URL(config.evolutionUrl)
    const ids = [config.abas.origem, config.abas.validacao, config.abas.exportacao]
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || typeof config.planilhaId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(config.planilhaId)
      || typeof config.instancia !== 'string' || !config.instancia.trim()
      || /[\u0000-\u001f\u007f]/.test(config.instancia)
      || ids.some(id => !Number.isSafeInteger(id) || id < 0) || new Set(ids).size !== 3) throw new Error()
    encodeURIComponent(config.instancia)
  } catch {
    throw new Error('Configuração inválida')
  }
}

export function gerarWorkflowSimples(config: WorkflowSimplesConfig): WorkflowExport {
  validarConfig(config)
  const nodes: WorkflowNode[] = []
  const connections: Record<string, { main: Ligacao[][] }> = {}
  const sheetsUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + config.planilhaId
  const add = (name: string, type: string, typeVersion: number, parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    nodes.push({ id: 'crm-simples-' + (nodes.length + 1), name,
      type: type.includes('.') ? type : 'n8n-nodes-base.' + type, typeVersion,
      position: [(nodes.length % 8) * 280, Math.floor(nodes.length / 8) * 260], parameters, ...extra })
  }
  const code = (name: string, body: string, lib = false) => add(name, 'code', 2, {
    mode: 'runOnceForAllItems', jsCode: (lib ? 'const lib = ' + compilarBibliotecaSimples() + ';\n' : '') + body,
  })
  const ligar = (de: string, para: string, saida = 0) => {
    connections[de] ??= { main: [] }
    connections[de].main[saida] ??= []
    connections[de].main[saida].push({ node: para, type: 'main', index: 0 })
  }
  const sequencia = (...nomes: string[]) => nomes.slice(1).forEach((nome, i) => ligar(nomes[i], nome))
  const condicao = (name: string, expression: string) => add(name, 'if', 2.2, {
    conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{ id: 'condicao', leftValue: expression, rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' },
  })
  const sheet = (name: string, method: 'GET' | 'POST', url: string, parametros: Record<string, unknown> = {}) =>
    add(name, 'httpRequest', 4.2, {
      method, url, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      options: { timeout: 15000, redirect: { redirect: { followRedirects: false } }, response: { response: { responseFormat: 'json' } } },
      ...parametros,
    }, { onError: 'stopWorkflow' })
  const gravar = (name: string, fase: string) => sheet(name, 'POST', sheetsUrl + ':batchUpdate', {
    sendBody: true, specifyBody: 'json', jsonBody: '={{ { requests: $("Preparar publicação").first().json.plano.' + fase + ' } }}',
  })
  const consultar = (name: string, numeros: string) => add(name, 'n8n-nodes-evolution-api.evolutionApi', 1, {
    resource: 'chat-api', operation: 'check-number', instanceName: encodeURIComponent(config.instancia), numbers: numeros,
  }, { onError: 'continueRegularOutput' })

  add('Iniciar manual', 'manualTrigger', 1, {})
  sheet('Ler metadados', 'GET', sheetsUrl, { sendQuery: true, queryParameters: { parameters: [
    { name: 'fields', value: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))' },
  ] } })
  code('Validar metadados', 'const ids = ' + JSON.stringify(config.abas) + '\n' + String.raw`
const titulos = {origem:'planilha original scraping',validacao:'Validar numero whatsapp',exportacao:'Planilha exportar CRM'}
const sheets = $input.first().json.sheets
if (!Array.isArray(sheets)) throw new Error('metadados_invalidos')
const grades = {}
for (const chave of ['origem','validacao','exportacao']) {
  const correspondentes = sheets.filter(s => s.properties?.sheetId === ids[chave])
  const p = correspondentes[0]?.properties
  if (correspondentes.length !== 1 || p.title !== titulos[chave]
    || !Number.isSafeInteger(p.gridProperties?.rowCount) || p.gridProperties.rowCount < 1
    || !Number.isSafeInteger(p.gridProperties?.columnCount) || p.gridProperties.columnCount < 1) {
    throw new Error('metadados_invalidos')
  }
  grades[chave] = {linhas:p.gridProperties.rowCount,colunas:p.gridProperties.columnCount}
}
return [{json:{grades,origemRange:lib.rangeA1(titulos.origem,grades.origem.linhas,grades.origem.colunas)},pairedItem:{item:0}}]
`, true)
  sheet('Ler scraping', 'GET', '={{ ' + JSON.stringify(sheetsUrl + '/values/')
    + ' + encodeURIComponent($json.origemRange) }}', {
    sendQuery: true, queryParameters: { parameters: [{ name: 'valueRenderOption', value: 'FORMATTED_VALUE' }] },
  })
  code('Preparar coleta', String.raw`
const r = lib.lerColetaSheets($input.first().json.values ?? [])
if (!r.ok) throw new Error(r.motivo)
return [{json:{coleta:r.coleta,execucao:{id:String($execution.id),data:new Date().toISOString()}},pairedItem:{item:0}}]
`, true)
  code('Preparar lotes', String.raw`
const numeros = $input.first().json.coleta.numeros
if (!numeros.length) return [{json:{vazio:true,resultados:[]},pairedItem:{item:0}}]
const lotes = []
for (let i = 0; i < numeros.length; i += 10) lotes.push({json:{numeros:numeros.slice(i,i+10)},pairedItem:{item:0}})
return lotes
`)
  condicao('Há lotes', '={{ !$json.vazio }}')
  add('Loop lotes', 'splitInBatches', 3, { batchSize: 1, options: {} })
  add('Verificar conexão', 'httpRequest', 4.2, {
    method: 'GET', url: config.evolutionUrl.replace(/\/$/, '') + '/instance/connectionState/' + encodeURIComponent(config.instancia),
    authentication: 'predefinedCredentialType', nodeCredentialType: 'evolutionApi',
    options: { timeout: 15000, redirect: { redirect: { followRedirects: false } },
      response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } },
  }, { onError: 'continueRegularOutput' })
  code('Conferir conexão', String.raw`
const conexao = $input.first().json
const lote = $('Loop lotes').itemMatching(0).json
if (!(conexao.statusCode >= 200 && conexao.statusCode < 300 && conexao.body?.instance?.state === 'open')) {
  const coleta = $('Preparar coleta').first().json.coleta
  const inicio = coleta.numeros.indexOf(lote.numeros[0])
  const pendentes = new Set(coleta.numeros.slice(inicio))
  throw new Error(JSON.stringify({motivo:'instancia_desconectada',pendencias:coleta.linhas
    .filter(l => pendentes.has(l.numero)).map(l => ({linhas:[l.linha],numero:l.numero,motivo:'instancia_desconectada'}))}))
}
return [{json:lote,pairedItem:{item:0}}]
`)
  consultar('Consultar WhatsApp', '={{ $json.numeros.join(",") }}')
  code('Classificar primeira tentativa', String.raw`
const lote = $('Conferir conexão').itemMatching(0).json
const resultados = lib.classificarConsultaComunidade(lote.numeros,$input.first().json,true,new Date().toISOString())
return [{json:{numeros:lote.numeros,resultados,repetir:resultados.filter(r => r.estado === 'inconclusivo').map(r => r.numero)},pairedItem:{item:0}}]
`, true)
  condicao('Há inconclusivos', '={{ $json.repetir.length > 0 }}')
  add('Esperar tentativa', 'wait', 1.1, { resume: 'timeInterval', amount: 2, unit: 'seconds' })
  consultar('Consultar novamente', '={{ $json.repetir.join(",") }}')
  // A segunda tentativa só executa em alguns lotes. runIndex não identifica o lote.
  // O item vinculado transporta tanto os inconclusivos quanto os sucessos iniciais.
  code('Classificar segunda tentativa', String.raw`
const primeira = $('Classificar primeira tentativa').itemMatching(0).json
const segunda = lib.classificarConsultaComunidade(primeira.repetir,$input.first().json,true,new Date().toISOString())
const porNumero = new Map(segunda.map(r => [r.numero,r]))
const resultados = primeira.resultados.map(r => porNumero.get(r.numero) ?? r)
return [{json:{numeros:primeira.numeros,resultados},pairedItem:{item:0}}]
`, true)
  code('Guardar resultado lote', String.raw`
const lote = $input.first().json
return [{json:{resultados:lote.resultados},pairedItem:{item:0}}]
`)
  add('Intervalo lote', 'wait', 1.1, { resume: 'timeInterval', amount: 0.75, unit: 'seconds' })
  code('Montar saídas', String.raw`
const coleta = $('Preparar coleta').first().json.coleta
const consultas = $input.all().flatMap(i => i.json.resultados ?? [])
const r = lib.montarSaidas(coleta,consultas)
if (!r.ok) throw new Error(JSON.stringify({motivo:r.motivo,pendencias:r.pendencias}))
return [{json:{saidas:r.saidas}}]
`, true)
  code('Preparar publicação', 'const destinos = ' + JSON.stringify({ validacao: config.abas.validacao, exportacao: config.abas.exportacao }) + '\n' + String.raw`
const saidas = $input.first().json.saidas
const execucao = $('Preparar coleta').first().json.execucao
const grades = $('Validar metadados').first().json.grades
const plano = lib.prepararPublicacao(destinos,saidas,execucao,grades)
const ranges = {}
for (const [chave,titulo] of [['validacao','Validar numero whatsapp'],['exportacao','Planilha exportar CRM']]) {
  ranges[chave] = lib.rangeA1(titulo,Math.max(grades[chave].linhas,plano.esperado[chave].length),
    Math.max(grades[chave].colunas,plano.esperado[chave][0].length))
}
return [{json:{plano,ranges},pairedItem:{item:0}}]
`, true)
  gravar('Marcar processamento', 'inicio')
  gravar('Substituir saídas', 'dados')
  // A URL preserva os dois parâmetros ranges sem depender da serialização de
  // nomes repetidos/arrays do editor HTTP Request instalado.
  sheet('Ler saídas', 'GET', '={{ ' + JSON.stringify(sheetsUrl + '/values:batchGet?ranges=')
    + ' + encodeURIComponent($("Preparar publicação").first().json.ranges.validacao)'
    + ' + "&ranges=" + encodeURIComponent($("Preparar publicação").first().json.ranges.exportacao)'
    + ' + "&valueRenderOption=FORMATTED_VALUE" }}')
  code('Conferir saídas', String.raw`
const ranges = $input.first().json.valueRanges
if (!Array.isArray(ranges) || ranges.length !== 2 || ranges.some(r => !Array.isArray(r.values) || !r.values.every(Array.isArray))) {
  throw new Error('gravacao_incompleta')
}
const esperado = $('Preparar publicação').first().json.plano.esperado
const r = lib.conferirSaidas(esperado,{validacao:ranges[0].values,exportacao:ranges[1].values})
if (!r.ok) throw new Error(r.motivo)
return [{json:{conferido:true},pairedItem:{item:0}}]
`, true)
  gravar('Concluir notas', 'conclusao')
  code('Relatório final', String.raw`
const preparacao = $('Preparar coleta').first().json
const saidas = $('Montar saídas').first().json.saidas
return [{json:{execucao:preparacao.execucao.id,data:preparacao.execucao.data,
  situacao:saidas.pendencias.length ? 'concluído com pendências' : 'concluído',
  empresasLidas:preparacao.coleta.linhas.length,empresasExportadas:saidas.exportacao.length,
  validos:saidas.validos.length,invalidos:saidas.invalidos.length,
  pendencias:saidas.pendencias,duplicadas:saidas.duplicadas,compartilhados:saidas.compartilhados,mensagensEnviadas:0}}]
`)

  sequencia('Iniciar manual', 'Ler metadados', 'Validar metadados', 'Ler scraping', 'Preparar coleta', 'Preparar lotes', 'Há lotes')
  ligar('Há lotes', 'Loop lotes', 0)
  ligar('Há lotes', 'Montar saídas', 1)
  ligar('Loop lotes', 'Montar saídas', 0)
  ligar('Loop lotes', 'Verificar conexão', 1)
  sequencia('Verificar conexão', 'Conferir conexão', 'Consultar WhatsApp', 'Classificar primeira tentativa', 'Há inconclusivos')
  ligar('Há inconclusivos', 'Esperar tentativa', 0)
  ligar('Há inconclusivos', 'Guardar resultado lote', 1)
  sequencia('Esperar tentativa', 'Consultar novamente', 'Classificar segunda tentativa', 'Guardar resultado lote', 'Intervalo lote', 'Loop lotes')
  sequencia('Montar saídas', 'Preparar publicação', 'Marcar processamento', 'Substituir saídas', 'Ler saídas', 'Conferir saídas', 'Concluir notas', 'Relatório final')
  return { name: 'CRM Prospecção Validação WhatsApp Sheets Simples', nodes, connections, settings: {
    executionOrder: 'v1', timezone: 'America/Sao_Paulo', saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false,
  } }
}