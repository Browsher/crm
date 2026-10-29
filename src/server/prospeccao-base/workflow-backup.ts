import { gerarWorkflowSimples, type WorkflowSimplesConfig } from './workflow-simples'
import { compilarBibliotecaSimples } from './codigo-simples'
import type { WorkflowExport, WorkflowNode } from './workflow'

type Ligacao = { node: string; type: 'main'; index: number }

export function gerarWorkflowComBackup(config: WorkflowSimplesConfig & { backupId: number }): WorkflowExport {
  const workflow = gerarWorkflowSimples(config)
  if (!Number.isSafeInteger(config.backupId) || config.backupId < 0
    || Object.values(config.abas).includes(config.backupId)) throw new Error('Configuração inválida')
  const nodes = workflow.nodes
  const connections = workflow.connections as Record<string, { main: Ligacao[][] }>
  const node = (nome: string) => {
    const encontrado = nodes.find(n => n.name === nome)
    if (!encontrado) throw new Error('Nó simples ausente: ' + nome)
    return encontrado
  }
  const simples = 'const lib = ' + compilarBibliotecaSimples() + ';\n'
  const biblioteca = 'const lib = ' + compilarBibliotecaSimples(true) + ';\n'
  const corpo = (nome: string) => {
    const codigo = String(node(nome).parameters.jsCode)
    return codigo.startsWith(simples) ? codigo.slice(simples.length) : codigo
  }
  const codigo = (nome: string, jsCode: string) => { node(nome).parameters.jsCode = biblioteca + jsCode }
  const adicionar = (base: WorkflowNode, nome: string, parameters: Record<string, unknown>) => {
    const n = { ...structuredClone(base), id: 'crm-backup-' + nodes.length, name: nome, parameters,
      position: [(nodes.length % 8) * 280, Math.floor(nodes.length / 8) * 260] as [number, number] }
    nodes.push(n)
    return n
  }
  const code = (nome: string, jsCode: string) => adicionar(node('Preparar coleta'), nome, {
    mode: 'runOnceForAllItems', jsCode: biblioteca + jsCode,
  })
  // Ler a aba inteira também cobre acréscimos concorrentes além da grade inicial.
  const ler = (nome: string, titulo: string) => adicionar(node('Ler scraping'), nome, {
    ...node('Ler scraping').parameters, range: "'" + titulo + "'",
  })
  const gravar = (nome: string, expressao: string) => adicionar(node('Substituir saídas'), nome, {
    ...node('Substituir saídas').parameters, jsonBody: '={{ { requests: ' + expressao + ' } }}',
  })
  const sequencia = (...nomes: string[]) => nomes.slice(1).forEach((nome, i) => {
    connections[nomes[i]] = { main: [[{ node: nome, type: 'main', index: 0 }]] }
  })

  const metadados = corpo('Validar metadados')
  codigo('Validar metadados', 'const r = (() => {\n' + metadados + '\n})()\nconst backupId = ' + config.backupId + '\n' + String.raw`
const correspondentes = $input.first().json.sheets.filter(s => s.properties?.sheetId === backupId)
const p = correspondentes[0]?.properties
if (correspondentes.length !== 1 || p.title !== 'Backup telefones'
  || !Number.isSafeInteger(p.gridProperties?.rowCount) || p.gridProperties.rowCount < 1
  || !Number.isSafeInteger(p.gridProperties?.columnCount) || p.gridProperties.columnCount < 1) throw new Error('metadados_invalidos')
r[0].json.grades.backup = {linhas:p.gridProperties.rowCount,colunas:p.gridProperties.columnCount}
return r
`)
  code('Validar coleta', corpo('Preparar coleta'))
  ler('Ler backup', 'Backup telefones')
  ler('Ler exportação anterior', 'Planilha exportar CRM')
  code('Preparar preservação', 'const backupId = ' + config.backupId + '\n' + String.raw`
const valores = $('Ler backup').first().json.values
const inicial = lib.consolidarBackupTelefones(valores,[lib.COLUNAS_CRM])
if (!inicial.ok) throw new Error(inicial.motivo)
const r = lib.consolidarBackupTelefones(valores,$input.first().json.values)
if (!r.ok) throw new Error(r.motivo)
const grade = $('Validar metadados').first().json.grades.backup
return [{json:{backup:r.backup,requests:lib.prepararAcrescimoBackup(backupId,inicial.backup.matriz,r.backup.matriz,grade)},pairedItem:{item:0}}]
`)
  gravar('Preservar backup', '$("Preparar preservação").first().json.requests')
  ler('Ler backup preservado', 'Backup telefones')
  code('Conferir preservação', String.raw`
const r = lib.conferirBackup($('Preparar preservação').first().json.backup.matriz,$input.first().json.values)
if (!r.ok) throw new Error(r.motivo)
return [{json:{conferido:true},pairedItem:{item:0}}]
`)
  codigo('Preparar coleta', String.raw`
const original = $('Validar coleta').first().json
const historico = $('Preparar preservação').first().json.backup
const r = lib.filtrarColetaPorBackup(original.coleta,historico.numeros)
return [{json:{...original,coletaOriginal:original.coleta,coleta:r.coleta,repetidos:r.repetidos},pairedItem:{item:0}}]
`)
  code('Preparar limpeza', 'const destinos = ' + JSON.stringify({ validacao: config.abas.validacao, exportacao: config.abas.exportacao }) + '\n' + String.raw`
const vazias = lib.montarSaidas({linhas:[],numeros:[],pendencias:[]},[])
const preparacao = $('Preparar coleta').first().json
const plano = lib.prepararPublicacao(destinos,vazias.saidas,preparacao.execucao,$('Validar metadados').first().json.grades)
for (const request of plano.inicio) {
  for (const linha of request.updateCells.rows) for (const cell of linha.values) cell.note += '\nExecução incompleta até conferência final'
}
return [{json:{requests:[...plano.inicio,...plano.dados]},pairedItem:{item:0}}]
`)
  gravar('Limpar saídas', '$("Preparar limpeza").first().json.requests')
  node('Preparar lotes').parameters.jsCode = corpo('Preparar lotes').replace(
    'const numeros = $input.first().json.coleta.numeros',
    "const numeros = $('Preparar coleta').first().json.coleta.numeros")

  const publicacao = corpo('Preparar publicação')
  codigo('Preparar publicação', 'const r = (() => {\n' + publicacao + '\n})()\nconst backupId = ' + config.backupId + '\n' + String.raw`
const anterior = $('Preparar preservação').first().json.backup
const rBackup = lib.consolidarBackupTelefones(anterior.matriz,r[0].json.plano.esperado.exportacao)
if (!rBackup.ok) throw new Error(rBackup.motivo)
const grade = $('Validar metadados').first().json.grades.backup
const plano = r[0].json.plano
plano.dados.push(...lib.prepararAcrescimoBackup(backupId,anterior.matriz,rBackup.backup.matriz,
  {...grade,linhas:Math.max(grade.linhas,anterior.matriz.length)}))
plano.esperado.backup = rBackup.backup.matriz
const preparacao = $('Preparar coleta').first().json
const repetidos = preparacao.repetidos.reduce((s,r) => s + r.linhas.length,0)
for (const request of plano.conclusao) {
  for (const linha of request.updateCells.rows) for (const cell of linha.values) {
    cell.note += '\nrepetidos ignorados: ' + repetidos + '\ntotal no backup: ' + rBackup.backup.numeros.length
  }
}
r[0].json.totalBackup = rBackup.backup.numeros.length
return r
`)
  ler('Reler backup', 'Backup telefones')
  code('Conferir backup atual', String.raw`
const r = lib.conferirBackup($('Preparar preservação').first().json.backup.matriz,$input.first().json.values)
if (!r.ok) throw new Error(r.motivo)
return [{json:{conferido:true},pairedItem:{item:0}}]
`)
  node('Ler validação').parameters.range = "'Validar numero whatsapp'"
  node('Ler exportação').parameters.range = "'Planilha exportar CRM'"
  ler('Ler backup final', 'Backup telefones')
  const conferencia = corpo('Conferir saídas').replace('const exportacao = $input.first().json.values',
    "const exportacao = $('Ler exportação').first().json.values")
  codigo('Conferir saídas', 'const r = (() => {\n' + conferencia + '\n})()\n' + String.raw`
const b = lib.conferirBackup($('Preparar publicação').first().json.plano.esperado.backup,$input.first().json.values)
if (!b.ok) throw new Error(b.motivo)
return r
`)
  const relatorio = corpo('Relatório final')
  codigo('Relatório final', 'const r = (() => {\n' + relatorio + '\n})()\n' + String.raw`
const preparacao = $('Preparar coleta').first().json
r[0].json.empresasLidas = preparacao.coletaOriginal.linhas.length
r[0].json.repetidosIgnorados = preparacao.repetidos.reduce((s,r) => s + r.linhas.length,0)
r[0].json.repetidos = preparacao.repetidos
r[0].json.totalBackup = $('Preparar publicação').first().json.totalBackup
return r
`)

  nodes.splice(nodes.indexOf(node('Marcar processamento')), 1)
  delete connections['Marcar processamento']
  sequencia('Ler scraping', 'Validar coleta', 'Ler backup', 'Ler exportação anterior', 'Preparar preservação',
    'Preservar backup', 'Ler backup preservado', 'Conferir preservação', 'Preparar coleta', 'Preparar limpeza', 'Limpar saídas', 'Preparar lotes')
  sequencia('Montar saídas', 'Preparar publicação', 'Reler backup', 'Conferir backup atual', 'Substituir saídas',
    'Ler validação', 'Ler exportação', 'Ler backup final', 'Conferir saídas', 'Concluir notas', 'Relatório final')
  workflow.name = 'CRM Prospecção Validação WhatsApp Sheets com Backup'
  return workflow
}
