import { gerarWorkflowComBackup } from './workflow-backup'
import type { WorkflowSimplesConfig } from './workflow-simples'
import { compilarBibliotecaSimples, compilarBibliotecaDrive } from './codigo-simples'
import type { WorkflowExport, WorkflowNode } from './workflow'

export type WorkflowDriveConfig = WorkflowSimplesConfig & { backupId: number; driveRaizId: string }
type Ligacao = { node: string; type: 'main'; index: number }

// Google Drive nativo v3: contratos conferidos no código n8n@2.36.8.
// github.com/n8n-io/n8n/tree/n8n%402.36.8/packages/nodes-base/nodes/Google/Drive/v2/actions
// docs.n8n.io/build/code-in-n8n/cookbook/code-node/get-the-binary-data-buffer/
export function gerarWorkflowComDrive(config: WorkflowDriveConfig): WorkflowExport {
  if (typeof config?.driveRaizId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(config.driveRaizId)) throw new Error('Configuração inválida')
  const w = gerarWorkflowComBackup(config)
  const nodes = w.nodes
  const connections = w.connections as Record<string, { main: Ligacao[][] }>
  const backup = 'const lib = ' + compilarBibliotecaSimples(true) + ';\n'
  const drive = 'const drive = ' + compilarBibliotecaDrive() + ';\n'
  const node = (nome: string) => {
    const n = nodes.find(n => n.name === nome)
    if (!n) throw new Error('Nó backup ausente: ' + nome)
    return n
  }
  const corpo = (nome: string) => String(node(nome).parameters.jsCode).replace(backup, '')
  const add = (name: string, type: string, typeVersion: number, parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const n: WorkflowNode = { id: 'crm-drive-' + nodes.length, name, type: 'n8n-nodes-base.' + type, typeVersion,
      position: [(nodes.length % 8) * 280, Math.floor(nodes.length / 8) * 260], parameters, ...extra }
    nodes.push(n)
    return n
  }
  const code = (nome: string, codigo: string) => add(nome, 'code', 2, { mode: 'runOnceForAllItems', jsCode: drive + codigo })
  const alterar = (nome: string, codigo: string) => { node(nome).parameters.jsCode = backup + drive + codigo }
  const ligar = (de: string, para: string, saida = 0) => {
    connections[de] ??= { main: [] }
    connections[de].main[saida] ??= []
    connections[de].main[saida].push({ node: para, type: 'main', index: 0 })
  }
  const sequencia = (...nomes: string[]) => nomes.slice(1).forEach((nome, i) => {
    connections[nomes[i]] = { main: [[{ node: nome, type: 'main', index: 0 }]] }
  })
  const condicao = (nome: string, expressao: string) => add(nome, 'if', 2.2, {
    conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{ id: 'condicao', leftValue: expressao, rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' },
  })
  const rlc = (value: string) => ({ __rl: true, value, mode: 'id' })
  const nativo = (nome: string, parameters: Record<string, unknown>) => add(nome, 'googleDrive', 3,
    { authentication: 'oAuth2', ...parameters }, { onError: 'stopWorkflow', alwaysOutputData: true })
  const metadata = (nome: string, id: string, fields: string) => add(nome, 'httpRequest', 4.2, {
    method: 'GET', url: id.startsWith('={{') ? id : 'https://www.googleapis.com/drive/v3/files/' + id,
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleDriveOAuth2Api',
    sendQuery: true, queryParameters: { parameters: [{ name: 'fields', value: fields }, { name: 'supportsAllDrives', value: 'true' }] },
    options: { timeout: 15000, redirect: { redirect: { followRedirects: false } }, response: { response: { responseFormat: 'json' } } },
  }, { onError: 'stopWorkflow' })
  const sheetsUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + config.planilhaId
  const gravar = (nome: string, requests: string) => {
    const base = node('Substituir saídas')
    nodes.push({ ...structuredClone(base), id: 'crm-drive-' + nodes.length, name: nome,
      position: [(nodes.length % 8) * 280, Math.floor(nodes.length / 8) * 260],
      parameters: { ...base.parameters, jsonBody: '={{ { requests: ' + requests + ' } }}' } })
  }
  const leitura = (nome: string, titulo: string) => {
    const base = node('Ler scraping')
    nodes.push({ ...structuredClone(base), id: 'crm-drive-' + nodes.length, name: nome,
      position: [(nodes.length % 8) * 280, Math.floor(nodes.length / 8) * 260],
      parameters: { ...base.parameters, range: "'" + titulo + "'" } })
  }
  const notaRequest = (nota: string) => '[{updateCells:{range:{sheetId:' + config.abas.exportacao
    + ",startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:1},rows:[{values:[{note:" + nota + "}]}],fields:'note'}}]"
  const fields = 'id,name,mimeType,parents,trashed,size,sha256Checksum'
  metadata('Ler raiz Drive', config.driveRaizId, 'id,name,mimeType,parents,trashed,capabilities(canAddChildren)')
  code('Validar raiz Drive', 'const raizId = ' + JSON.stringify(config.driveRaizId) + '\n' + String.raw`
const r = $input.first().json
if (r.id !== raizId || r.name !== 'CRM' || r.mimeType !== 'application/vnd.google-apps.folder'
  || r.trashed !== false || r.capabilities?.canAddChildren !== true) throw new Error('raiz_drive_invalida')
return [{json:{raizId},pairedItem:{item:0}}]
`)
  add('Ler contexto Drive', 'httpRequest', 4.2, {
    ...node('Ler metadados').parameters, url: sheetsUrl, sendQuery: true, queryParameters: { parameters: [
      { name: 'ranges', value: "'Planilha exportar CRM'!A1" },
      { name: 'fields', value: 'sheets(properties(sheetId),data(rowData(values(note))))' },
    ] },
  }, { onError: 'stopWorkflow' })
  add('Ler nota origem Drive', 'httpRequest', 4.2, {
    ...node('Ler contexto Drive').parameters, queryParameters: { parameters: [
      { name: 'ranges', value: "'planilha original scraping'!A1" },
      { name: 'fields', value: 'sheets(properties(sheetId),data(rowData(values(note))))' },
    ] },
  }, { onError: 'stopWorkflow' })
  leitura('Ler exportação pendente', 'Planilha exportar CRM')
  code('Preparar pendência Drive', 'const raizId = ' + JSON.stringify(config.driveRaizId) + '\nconst exportacaoId = ' + config.abas.exportacao + '\n' + String.raw`
const sheets = $('Ler contexto Drive').first().json.sheets
if (!Array.isArray(sheets)) throw new Error('contexto_drive_ilegivel')
const correspondentes = sheets.filter(s => s.properties?.sheetId === exportacaoId)
if (correspondentes.length !== 1) throw new Error('contexto_drive_ilegivel')
const nota = correspondentes[0].data?.[0]?.rowData?.[0]?.values?.[0]?.note ?? ''
const m = drive.lerManifestoDrive(nota,raizId)
if (!m.ok) throw new Error(m.motivo)
if (!m.manifesto) return [{json:{pendente:false,nota},pairedItem:{item:0}}]
if (m.manifesto.tipo !== 'exportacao') throw new Error('manifesto_drive_invalido')
const csv = drive.criarCsvDrive(drive.matrizSheetsDrive($input.first().json.values))
if (!csv.ok || csv.csvSha256 !== m.manifesto.csvSha256 || csv.linhas !== m.manifesto.linhas) throw new Error('exportacao_drive_divergente')
return [{json:{pendente:m.manifesto.estado === 'pendente',manifesto:m.manifesto,csv:csv.csv,bytes:csv.bytes,nota},pairedItem:{item:0}}]
`)
  condicao('Há arquivo pendente', '={{ $json.pendente }}')

  // Percursos separados recuperam publicação anterior antes de ler a origem atual.
  const arquivar = (sufixo: 'pendente' | 'atual', preparador: string) => {
    const contexto = "$('" + preparador + "').first().json"
    const expressao = (codigo: string) => '={{ ' + codigo + ' }}'
    metadata('Ler pasta ' + sufixo, expressao("'https://www.googleapis.com/drive/v3/files/' + " + contexto + '.manifesto.pastaId'), fields)
    code('Conferir pasta ' + sufixo, 'const c = ' + contexto + '\n' + String.raw`
const r = drive.conferirPastaDrive($input.first().json,c.manifesto.raizId,c.manifesto.pastaId)
if (!r.ok) throw new Error(r.motivo)
return [{json:{...c,query:drive.queryArquivoDrive(c.manifesto.pastaId,c.manifesto.nome)},pairedItem:{item:0}}]
`)
    nativo('Buscar CSV ' + sufixo, { resource: 'fileFolder', operation: 'search', searchMethod: 'query',
      queryString: '={{ $json.query }}', returnAll: true, filter: {}, options: { fields: ['*'] } })
    code('Selecionar CSV ' + sufixo, String.raw`
const encontrados = $input.all().map(i => i.json).filter(a => a.id)
if (encontrados.length > 1) throw new Error('arquivo_drive_ambiguo')
if (encontrados.length && !/^[a-zA-Z0-9_-]+$/.test(encontrados[0].id)) throw new Error('arquivo_drive_invalido')
return [{json:{existe:encontrados.length === 1,arquivoId:encontrados[0]?.id},pairedItem:{item:0}}]
`)
    condicao('CSV existe ' + sufixo, '={{ $json.existe }}')
    code('Preparar binário ' + sufixo, 'const c = ' + contexto + '\n' + String.raw`
return [{json:c,binary:{data:{data:Buffer.from(c.csv,'utf8').toString('base64'),mimeType:'text/csv',fileName:c.manifesto.nome,fileExtension:'csv'}},pairedItem:{item:0}}]
`)
    nativo('Enviar CSV ' + sufixo, { resource: 'file', operation: 'upload', inputDataFieldName: 'data',
      name: '={{ $json.manifesto.nome }}', driveId: { __rl: true, value: 'My Drive', mode: 'list' }, folderId: rlc('={{ $json.manifesto.pastaId }}'),
      options: { simplifyOutput: false } })
    metadata('Ler arquivo ' + sufixo, "={{ 'https://www.googleapis.com/drive/v3/files/' + ($json.arquivoId || $json.id) }}", fields)
    code('Conferir arquivo ' + sufixo, 'const c = ' + contexto + '\n' + String.raw`
const a = $input.first().json, m = c.manifesto
if (!/^[a-zA-Z0-9_-]+$/.test(a.id) || a.name !== m.nome || a.mimeType !== 'text/csv'
  || a.trashed !== false || !Array.isArray(a.parents) || a.parents.length !== 1 || a.parents[0] !== m.pastaId
  || String(a.size) !== String(c.bytes) || a.sha256Checksum !== undefined && a.sha256Checksum !== m.csvSha256
  || m.arquivoId !== undefined && a.id !== m.arquivoId) throw new Error('arquivo_drive_divergente')
return [{json:{...c,id:a.id},pairedItem:{item:0}}]
`)
    nativo('Baixar CSV ' + sufixo, { resource: 'file', operation: 'download', fileId: rlc('={{ $json.id }}'), options: { binaryPropertyName: 'data' } })
    code('Conferir CSV ' + sufixo, 'const c = ' + contexto + '\n' + "const id = $('Conferir arquivo " + sufixo + "').first().json.id\n" + String.raw`
const buffer = await this.helpers.getBinaryDataBuffer(0,'data')
if (!buffer.equals(Buffer.from(c.csv,'utf8'))) throw new Error('arquivo_drive_divergente')
return [{json:{...c,manifesto:{...c.manifesto,estado:'salvo',arquivoId:id},id,link:'https://drive.google.com/file/d/'+id+'/view'},pairedItem:{item:0}}]
`)
    sequencia('Ler pasta ' + sufixo, 'Conferir pasta ' + sufixo, 'Buscar CSV ' + sufixo, 'Selecionar CSV ' + sufixo, 'CSV existe ' + sufixo)
    ligar('CSV existe ' + sufixo, 'Ler arquivo ' + sufixo)
    ligar('CSV existe ' + sufixo, 'Preparar binário ' + sufixo, 1)
    sequencia('Preparar binário ' + sufixo, 'Enviar CSV ' + sufixo, 'Ler arquivo ' + sufixo, 'Conferir arquivo ' + sufixo, 'Baixar CSV ' + sufixo, 'Conferir CSV ' + sufixo)
  }
  arquivar('pendente', 'Preparar pendência Drive')
  code('Preparar nota recuperada', String.raw`
const c = $input.first().json
const nota = drive.escreverManifestoDrive(c.nota,c.manifesto)
return [{json:{requests:NOTAREQUEST},pairedItem:{item:0}}]
`.replace('NOTAREQUEST', notaRequest('nota')))
  gravar('Concluir pendência Drive', '$json.requests')
  sequencia('Conferir CSV pendente', 'Preparar nota recuperada', 'Concluir pendência Drive', 'Ler metadados')

  const validar = corpo('Validar coleta')
  alterar('Validar coleta', 'const valores = $input.first().json.values\nconst r = (() => {\n' + validar + '\n})()\n'
    + 'const origemId = ' + config.abas.origem + '\nconst raizId = ' + JSON.stringify(config.driveRaizId) + '\n' + String.raw`
const sheets = $('Ler nota origem Drive').first().json.sheets
const correspondentes = sheets.filter(s => s.properties?.sheetId === origemId)
if (correspondentes.length !== 1) throw new Error('contexto_drive_ilegivel')
const nota = correspondentes[0].data?.[0]?.rowData?.[0]?.values?.[0]?.note ?? ''
const origem = drive.resolverOrigemDrive(valores,nota,raizId)
if (!origem.ok) throw new Error(origem.faltas ? JSON.stringify({motivo:origem.motivo,faltas:origem.faltas}) : origem.motivo)
r[0].json.contextoDrive = origem.contexto
r[0].json.csvOrigem = drive.criarCsvDrive(drive.matrizSheetsDrive(valores))
return r
`)
  code('Preparar pasta origem', String.raw`
const c = $('Validar coleta').first().json.contextoDrive
return [{json:{contexto:c,temPasta:!!c.pastaId,query:drive.queryArquivoDrive(c.raizId,drive.nomePastaDrive(c))},pairedItem:{item:0}}]
`)
  condicao('Origem tem pasta', '={{ $json.temPasta }}')
  nativo('Buscar pasta origem', { resource: 'fileFolder', operation: 'search', searchMethod: 'query',
    queryString: '={{ $json.query }}', returnAll: true, filter: {}, options: { fields: ['*'] } })
  code('Selecionar pasta origem', String.raw`
const encontrados = $input.all().map(i => i.json).filter(a => a.id)
if (encontrados.length > 1) throw new Error('pasta_drive_ambigua')
if (encontrados.length && !/^[a-zA-Z0-9_-]+$/.test(encontrados[0].id)) throw new Error('pasta_drive_invalida')
return [{json:{existe:encontrados.length === 1,id:encontrados[0]?.id},pairedItem:{item:0}}]
`)
  condicao('Pasta origem existe', '={{ $json.existe }}')
  code('Preparar nova pasta', String.raw`
const c = $('Validar coleta').first().json.contextoDrive
return [{json:{...c,nomePasta:drive.nomePastaDrive(c)},pairedItem:{item:0}}]
`)
  nativo('Criar pasta origem', { resource: 'folder', operation: 'create', name: '={{ $json.nomePasta }}',
    driveId: { __rl: true, value: 'My Drive', mode: 'list' }, folderId: rlc(config.driveRaizId), options: { simplifyOutput: false } })
  code('Escolher pasta origem', String.raw`
const c = $('Validar coleta').first().json.contextoDrive
const id = c.pastaId || $input.first().json.id
if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('pasta_drive_invalida')
return [{json:{...c,pastaId:id},pairedItem:{item:0}}]
`)
  metadata('Ler pasta origem', "={{ 'https://www.googleapis.com/drive/v3/files/' + $json.pastaId }}", fields)
  code('Conferir pasta origem', String.raw`
const c = $('Escolher pasta origem').first().json
const p = drive.conferirPastaDrive($input.first().json,c.raizId,c.pastaId)
if (!p.ok) throw new Error(p.motivo)
return [{json:{...c,temOriginal:!!c.arquivoId},pairedItem:{item:0}}]
`)
  condicao('Há original Drive', '={{ $json.temOriginal }}')
  metadata('Ler arquivo original', "={{ 'https://www.googleapis.com/drive/v3/files/' + $json.arquivoId }}", fields)
  code('Conferir arquivo original', String.raw`
const c = $('Conferir pasta origem').first().json, a = $input.first().json
const csv = $('Validar coleta').first().json.csvOrigem
if (a.id !== c.arquivoId || a.name !== c.nome || a.mimeType !== 'text/csv' || a.trashed !== false
  || !Array.isArray(a.parents) || a.parents.length !== 1 || a.parents[0] !== c.pastaId
  || String(a.size) !== String(csv.bytes) || a.sha256Checksum !== undefined && a.sha256Checksum !== csv.csvSha256) throw new Error('arquivo_drive_divergente')
return [{json:a,pairedItem:{item:0}}]
`)
  nativo('Baixar original Drive', { resource: 'file', operation: 'download', fileId: rlc('={{ $json.id }}'), options: { binaryPropertyName: 'data' } })
  code('Conferir original Drive', String.raw`
const esperado = $('Validar coleta').first().json.csvOrigem.csv
const buffer = await this.helpers.getBinaryDataBuffer(0,'data')
if (!buffer.equals(Buffer.from(esperado,'utf8'))) throw new Error('arquivo_drive_divergente')
return [{json:{conferido:true},pairedItem:{item:0}}]
`)
  const publicacao = corpo('Preparar publicação')
  alterar('Preparar publicação', 'const r = (() => {\n' + publicacao + '\n})()\n' + String.raw`
const plano = r[0].json.plano
const c = $('Conferir pasta origem').first().json
const execucao = $('Preparar coleta').first().json.execucao
const arquivo = drive.criarExportacaoDrive(c,plano.esperado.exportacao,execucao)
if (!arquivo.ok) throw new Error(arquivo.motivo)
const anterior = $('Preparar pendência Drive').first().json.nota ?? ''
const nota = drive.escreverManifestoDrive(anterior + '\nArquivo CRM pendente de conferência no Drive',arquivo.manifesto)
plano.dados.push(...NOTAREQUEST)
r[0].json.arquivoDrive = {...arquivo,nota}
return r
`.replace('NOTAREQUEST', notaRequest('nota')))
  code('Preparar arquivo atual', String.raw`
return [{json:$('Preparar publicação').first().json.arquivoDrive,pairedItem:{item:0}}]
`)
  arquivar('atual', 'Preparar arquivo atual')
  code('Preparar conclusão Drive', 'const exportacaoId = ' + config.abas.exportacao + '\n' + String.raw`
const c = $input.first().json
const plano = $('Preparar publicação').first().json.plano
for (const request of plano.conclusao) {
  if (request.updateCells?.range.sheetId === exportacaoId) {
    const cell = request.updateCells.rows[0].values[0]
    const nota = c.nota.split(/\r?\n/).filter(l => l !== 'Arquivo CRM pendente de conferência no Drive').join('\n')
    cell.note = drive.escreverManifestoDrive(nota + '\n' + cell.note,c.manifesto)
  }
}
return [{json:{...c,requests:plano.conclusao},pairedItem:{item:0}}]
`)
  node('Concluir notas').parameters.jsonBody = '={{ { requests: $json.requests } }}'
  const relatorio = corpo('Relatório final')
  alterar('Relatório final', 'const r = (() => {\n' + relatorio + '\n})()\n' + String.raw`
const a = $('Conferir CSV atual').first().json
const c = $('Conferir pasta origem').first().json
r[0].json.arquivoDrive = {id:a.id,link:a.link,nome:a.manifesto.nome,csvSha256:a.manifesto.csvSha256,pastaId:a.manifesto.pastaId}
r[0].json.origemManualSemUf = !!c.legado && c.uf === ''
return r
`)

  sequencia('Iniciar manual','Ler raiz Drive','Validar raiz Drive','Ler nota origem Drive','Ler contexto Drive','Ler exportação pendente','Preparar pendência Drive','Há arquivo pendente')
  ligar('Há arquivo pendente','Ler pasta pendente')
  ligar('Há arquivo pendente','Ler metadados',1)
  sequencia('Ler scraping','Validar coleta','Preparar pasta origem','Origem tem pasta')
  ligar('Origem tem pasta','Escolher pasta origem')
  ligar('Origem tem pasta','Buscar pasta origem',1)
  sequencia('Buscar pasta origem','Selecionar pasta origem','Pasta origem existe')
  ligar('Pasta origem existe','Escolher pasta origem')
  ligar('Pasta origem existe','Preparar nova pasta',1)
  sequencia('Preparar nova pasta','Criar pasta origem','Escolher pasta origem','Ler pasta origem','Conferir pasta origem','Há original Drive')
  ligar('Há original Drive','Ler arquivo original')
  ligar('Há original Drive','Ler backup',1)
  sequencia('Ler arquivo original','Conferir arquivo original','Baixar original Drive','Conferir original Drive','Ler backup')
  sequencia('Conferir saídas','Preparar arquivo atual','Ler pasta atual')
  sequencia('Conferir CSV atual','Preparar conclusão Drive','Concluir notas','Relatório final')
  w.name = 'CRM Prospecção Validação WhatsApp Sheets com Backup e CSV Drive'
  return w
}
