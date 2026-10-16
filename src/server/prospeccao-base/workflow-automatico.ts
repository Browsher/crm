import { gerarWorkflowComDrive, type WorkflowDriveConfig } from './workflow-drive'
import { compilarBibliotecaAutomatica } from './codigo-simples'
import type { WorkflowExport, WorkflowNode } from './workflow'

type Ligacao = { node: string; type: 'main'; index: number }

// Webhook 2.1 em n8n@2.36.8: description.ts define headerAuth (credencial
// httpHeaderAuth), lastNode e firstEntryJson. Credenciais são selecionadas no editor.
// github.com/n8n-io/n8n/blob/n8n%402.36.8/packages/nodes-base/nodes/Webhook/description.ts
export function gerarWorkflowAutomatico(config: WorkflowDriveConfig & { webhookPath: string }): WorkflowExport {
  if (typeof config?.webhookPath !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(config.webhookPath)) throw new Error('Configuração inválida')
  const w = gerarWorkflowComDrive(config)
  const nodes = w.nodes
  const connections = w.connections as Record<string, { main: Ligacao[][] }>
  const biblioteca = 'const auto = ' + compilarBibliotecaAutomatica() + ';\n'
  const node = (nome: string) => {
    const n = nodes.find(n => n.name === nome)
    if (!n) throw new Error('Nó Drive ausente')
    return n
  }
  const add = (name: string, type: string, typeVersion: number, parameters: Record<string, unknown>) => {
    const n: WorkflowNode = { id: 'crm-auto-' + nodes.length, name, type: 'n8n-nodes-base.' + type, typeVersion,
      position: [(nodes.length % 8) * 280, Math.floor(nodes.length / 8) * 260], parameters }
    nodes.push(n)
    return n
  }
  const code = (nome: string, jsCode: string) => add(nome,'code',2,{ mode: 'runOnceForAllItems', jsCode: biblioteca + jsCode })
  const envolver = (nome: string, depois: string) => {
    const anterior = String(node(nome).parameters.jsCode)
    node(nome).parameters.jsCode = biblioteca + 'const r = await (async () => {\n' + anterior + '\n})()\n' + depois
  }
  const sequencia = (...nomes: string[]) => nomes.slice(1).forEach((nome,i) => {
    connections[nomes[i]] = { main: [[{ node: nome, type: 'main', index: 0 }]] }
  })
  const condicao = (nome: string, expressao: string) => add(nome,'if',2.2,{
    conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{ id: 'condicao', leftValue: expressao, rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' },
  })
  const bifurcar = (nome: string, sim: string, nao: string) => {
    connections[nome] = { main: [[{ node: sim, type: 'main', index: 0 }],[{ node: nao, type: 'main', index: 0 }]] }
  }
  const notaOrigem = 'const sheets = $("Ler nota origem Drive").first().json.sheets\n'
    + 'const notas = Array.isArray(sheets) ? sheets.filter(s => s.properties?.sheetId === ' + config.abas.origem + ') : []\n'
    + 'if (notas.length !== 1) throw new Error("contexto_drive_ilegivel")\n'
    + 'const nota = notas[0].data?.[0]?.rowData?.[0]?.values?.[0]?.note\n'
  const conferirOrigem = (valores: string) => notaOrigem
    + 'const publicado = auto.conferirPublicacaoAutomatica($("Validar sinal automático").first().json.sinal,' + valores + ',nota,' + JSON.stringify(config.driveRaizId) + ')\n'
    + 'if (!publicado.ok) throw new Error(publicado.motivo)\n'

  nodes.splice(nodes.indexOf(node('Iniciar manual')),1)
  delete connections['Iniciar manual']
  add('Coleta pronta','webhook',2.1,{ httpMethod: 'POST', path: config.webhookPath, authentication: 'headerAuth', responseMode: 'lastNode', responseData: 'firstEntryJson', options: {} })
  code('Validar sinal automático','const destinos = ' + JSON.stringify({ planilhaId: config.planilhaId, origemId: config.abas.origem }) + '\n' + String.raw`
const r = auto.validarSinalColetaPronta($input.first().json.body,destinos)
if (!r.ok) throw new Error(r.motivo)
return [{json:{sinal:r.sinal},pairedItem:{item:0}}]
`)
  const base = node('Ler scraping')
  nodes.push({ ...structuredClone(base), id: 'crm-auto-' + nodes.length, name: 'Ler origem automática',
    parameters: { ...base.parameters, range: "'planilha original scraping'" } })
  code('Conferir publicação automática',conferirOrigem('$input.first().json.values') + String.raw`
return [{json:{manifesto:publicado.manifesto},pairedItem:{item:0}}]
`)
  envolver('Preparar pendência Drive',String.raw`
const c = r[0].json
const sinal = $('Validar sinal automático').first().json.sinal
const origem = $('Conferir publicação automática').first().json.manifesto
const resultado = auto.conferirExportacaoAutomatica(sinal,c.manifesto ?? null,c.nota,origem.linhas)
if (!resultado.ok) throw new Error(resultado.motivo)
return [{json:{...c,mesmoLote:resultado.mesmoLote,contagens:resultado.contagens},pairedItem:{item:0}}]
`)
  condicao('Lote já salvo','={{ $json.mesmoLote && !$json.pendente }}')
  code('Resposta existente',String.raw`
const c = $('Preparar pendência Drive').first().json
const sinal = $('Validar sinal automático').first().json.sinal
const resultado = auto.montarRespostaAutomatica(sinal,c.manifesto,c.contagens,'ja_concluido')
if (!resultado.ok) throw new Error(resultado.motivo)
return [{json:resultado.resposta,pairedItem:{item:0}}]
`)
  code('Conferir retomada automática',String.raw`
const c = $('Preparar pendência Drive').first().json
return [{json:{mesmoLote:c.mesmoLote},pairedItem:{item:0}}]
`)
  condicao('Retomada do mesmo lote','={{ $json.mesmoLote }}')
  code('Resposta recuperada',String.raw`
const c = $('Preparar pendência Drive').first().json
const manifesto = $('Conferir CSV pendente').first().json.manifesto
const sinal = $('Validar sinal automático').first().json.sinal
const resultado = auto.montarRespostaAutomatica(sinal,manifesto,c.contagens,'ja_concluido')
if (!resultado.ok) throw new Error(resultado.motivo)
return [{json:resultado.resposta,pairedItem:{item:0}}]
`)
  // Notas operacionais e manifesto salvo precisam concluir no mesmo batch:
  // uma falha intermediária não pode deixar salvo com cabeçalhos incompletos.
  envolver('Preparar nota recuperada','const destinos = ' + JSON.stringify({ validacao: config.abas.validacao, exportacao: config.abas.exportacao }) + '\n' + String.raw`
const pendencia = $('Preparar pendência Drive').first().json
if (!pendencia.mesmoLote) return r
const m = $('Conferir CSV pendente').first().json.manifesto
const c = pendencia.contagens
const resumo = 'Execução: ' + m.execucaoId + '\nData: ' + m.dataExecucao
  + '\nSituação: concluído' + (c.pendencias ? ' com pendências' : '')
  + '\nválidos: ' + c.validos + '\ninválidos: ' + c.invalidos
  + '\nexportadas: ' + c.empresasExportadas + '\npendências: ' + c.pendencias
const requests = r[0].json.requests
for (const req of requests) {
  const cell = req.updateCells.rows[0].values[0]
  const humano = cell.note.split(/\r?\n/).filter(l => ![
    'Situação: em processamento','Execução incompleta até conferência final','Arquivo CRM pendente de conferência no Drive',
  ].includes(l)).join('\n').replace(/\n+$/,'')
  cell.note = humano + '\n' + resumo
}
const concluir = (sheetId,colunas) => ({updateCells:{
  range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:colunas},
  rows:[{values:Array.from({length:colunas},() => ({note:resumo}))}],fields:'note',
}})
// A1 da exportação vem por último para preservar manifesto, assinatura e
// texto humano além do resumo que também conclui os demais cabeçalhos.
r[0].json.requests = [concluir(destinos.validacao,2),concluir(destinos.exportacao,9),...requests]
return r
`)
  // A releitura feita pelo percurso Drive também deve corresponder ao sinal.
  envolver('Validar coleta',conferirOrigem('$input.first().json.values') + 'return r\n')
  envolver('Preparar publicação','const exportacaoId = ' + config.abas.exportacao + '\n' + String.raw`
const p = r[0].json
const sinal = $('Validar sinal automático').first().json.sinal
const preparacao = $('Preparar coleta').first().json
const saidas = $('Montar saídas').first().json.saidas
const contagens = {empresasLidas:preparacao.coletaOriginal.linhas.length,empresasExportadas:saidas.exportacao.length,validos:saidas.validos.length,invalidos:saidas.invalidos.length,pendencias:saidas.pendencias.length}
p.contagensAutomaticas = contagens
p.arquivoDrive.nota = auto.escreverAssinaturaAutomatica(p.arquivoDrive.nota,sinal,contagens)
for (const req of p.plano.dados) {
  if (req.updateCells?.fields === 'note' && req.updateCells.range.sheetId === exportacaoId) {
    for (const linha of req.updateCells.rows) for (const cell of linha.values) cell.note = p.arquivoDrive.nota
  }
}
return r
`)
  node('Relatório final').parameters.jsCode = biblioteca + String.raw`
const sinal = $('Validar sinal automático').first().json.sinal
const manifesto = $('Conferir CSV atual').first().json.manifesto
const contagens = $('Preparar publicação').first().json.contagensAutomaticas
const r = auto.montarRespostaAutomatica(sinal,manifesto,contagens,'concluido')
if (!r.ok) throw new Error(r.motivo)
return [{json:r.resposta,pairedItem:{item:0}}]
`
  sequencia('Coleta pronta','Validar sinal automático','Ler nota origem Drive','Ler origem automática','Conferir publicação automática','Ler contexto Drive','Ler exportação pendente','Preparar pendência Drive','Lote já salvo')
  bifurcar('Lote já salvo','Resposta existente','Há arquivo pendente')
  bifurcar('Há arquivo pendente','Ler pasta pendente','Ler raiz Drive')
  sequencia('Concluir pendência Drive','Conferir retomada automática','Retomada do mesmo lote')
  bifurcar('Retomada do mesmo lote','Resposta recuperada','Ler raiz Drive')
  sequencia('Ler raiz Drive','Validar raiz Drive','Ler metadados')
  // O Webhook recebe cabeçalho privado. Fixar a política nesta variante evita
  // herdar persistência de histórico se a base manual mudar futuramente.
  w.settings = { ...w.settings, saveDataSuccessExecution: 'none', saveDataErrorExecution: 'none',
    saveManualExecutions: false, saveExecutionProgress: false }
  w.name = 'CRM Prospecção Automática com Backup e CSV Drive'
  return w
}
