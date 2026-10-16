import { runInNewContext } from 'node:vm'
import { expect, test, vi } from 'vitest'
import * as driveModule from './workflow-drive'
import { gerarWorkflowAutomatico } from './workflow-automatico'


import { criarCsvDrive, criarExportacaoDrive, escreverManifestoDrive, type ManifestoDrive } from '../../lib/prospeccao-base/arquivos-drive'


type Json = Record<string, unknown>
type Item = { binary?: Record<string, { data: string }>; json: Json; pairedItem?: { item: number } }
type Ligacao = { node: string; index: number }
const config = { planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test', instancia: 'loja / centro',
  abas: { origem: 1, validacao: 2, exportacao: 3 }, backupId: 10151005, driveRaizId: 'raiz-teste', webhookPath: 'crm-coleta-pronta-v1' }
const header = ['cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'telefone', 'email', 'cep', 'cnae_principal', 'google_place_id']
const fonte = (n = 11) => [['telefone', 'nome_empresa', 'place_id', 'bairro', 'cidade', 'data_coleta'],
  ...Array.from({ length: n }, (_, i) => ['11' + (26060000 + i), 'Loja ' + i, 'p' + i, 'Brás', 'São Paulo', '2026-10-16'])]
const resposta = (numeros: string[]) => ({ success: true, data: numeros.map(number => ({ number, exists: true })) })
const anterior = [[...header], ['', '', 'Anterior', '', '(21) 2222-3333', '', '', '', 'anterior']]
const titulos: Record<number, string> = { 1: 'planilha original scraping', 2: 'Validar numero whatsapp',
  3: 'Planilha exportar CRM', 10151005: 'Backup telefones' }
type Arquivo = { id: string; name: string; mimeType: string; parents: string[]; trashed: boolean; conteudo?: string }
type Opcoes = {
  sinal?: unknown; validacao?: unknown[][]; isolarNos?: boolean; downloadSemJson?: boolean; notaOrigem?: string; notaExportacao?: string; arquivos?: Arquivo[]; uploadIncerto?: boolean; metaRaiz?: Json; execucaoId?: string; fonte?: unknown[][]; backup?: unknown[][]; anterior?: unknown[][]; seguro?: boolean
  falha?: string; corromper?: string; concorrente?: boolean; concorrenteNaGravacao?: boolean; pequena?: boolean
  resposta?: (numeros: string[], tentativa: number, lote: number) => Json
  conexao?: Json; retorno?: Record<string, Json>; tituloBackup?: string
}

// Executa todo JavaScript exportado, com vínculo por item e loop reais. Só o
// transporte é sintético; as requests de Sheets alteram uma grade isolada.
async function percurso(op: Opcoes = {}) {
  const w = gerarWorkflowAutomatico(config)
  const historico: Record<string, Item[][]> = {}
  const vinculos = new WeakMap<Item, Record<string, Item>>()
  const vistos: string[] = []
  const consultas: { numeros: string[]; tentativa: number; lote: number }[] = []
  const batches: { nome: string; requests: Json[] }[] = []
  const grades: Record<number, unknown[][]> = { 1: structuredClone(op.fonte ?? fonte()),
    2: structuredClone(op.validacao ?? [['Válidos', 'Inválidos'], ['551121112222', '551121113333']]),
    3: structuredClone(op.anterior ?? anterior), 10151005: structuredClone(op.backup ?? [['telefone'], ['551126060000']]) }
  const dimensoes: Record<number, { rowCount: number; columnCount: number }> = Object.fromEntries(
    Object.keys(titulos).map(k => [k, op.pequena && k !== '1'
      ? { rowCount: grades[Number(k)].length, columnCount: k === '3' ? 9 : k === '2' ? 2 : 1 }
      : { rowCount: 100, columnCount: 40 }]))
  const notas: Record<number, string> = { 1: op.notaOrigem ?? 'Texto humano origem', 3: op.notaExportacao ?? 'Texto humano exportação' }
  const arquivos: Arquivo[] = structuredClone(op.arquivos ?? [])
  const uploads: string[] = []
  const pasta = { id: 'pasta-teste', name: '2026-10-16 - Brás - São Paulo', mimeType: 'application/vnd.google-apps.folder', parents: ['raiz-teste'], trashed: false }
  if (!arquivos.some(a => a.id === 'pasta-teste')) arquivos.push(pasta)
  let lote = 0
  const isolar = <T>(v: T): T => op.isolarNos !== false ? structuredClone(v) : v
  const contexto = (input: Item[], runIndex = 0) => ({
    $input: { all: () => input, first: () => input[0] }, $json: input[0]?.json,
    $execution: { id: op.execucaoId ?? 'exec-teste' }, $runIndex: runIndex, Date, Buffer,
    $: (nome: string) => ({ first: () => isolar(historico[nome]?.[0]?.[0]),
      all: (...indices: number[]) => isolar(historico[nome]?.[indices[1] ?? 0] ?? []),
      itemMatching: (index: number) => isolar(vinculos.get(input[index])?.[nome]) }),
  })
  const avaliar = (v: unknown, input: Item[]) => typeof v === 'string' && v.startsWith('={{')
    ? runInNewContext('(' + v.slice(3, -2) + ')', contexto(input)) : v
  const registrar = (nome: string, output: Item[], input: Item[]) => {
    historico[nome] ??= []
    historico[nome].push(output)
    for (const item of output) vinculos.set(item, { ...vinculos.get(input[item.pairedItem?.item ?? 0]), [nome]: item })
  }
  const destinos = (nome: string, saida = 0) =>
    (w.connections[nome] as { main: Ligacao[][] } | undefined)?.main[saida] ?? []
  const seguir = async (nome: string, input: Item[], noLoop = false): Promise<Item[]> => {
    if (nome === 'Loop lotes' && noLoop) return input
    const n = w.nodes.find(n => n.name === nome)!
    vistos.push(nome)
    if (op.falha === nome) throw new Error('transporte_indisponivel')
    let output = input
    let saida = 0
    if (n.type.endsWith('.code')) {
      const fn = runInNewContext((op.seguro ? 'Object.defineProperty = function(o){return o};' : '')
        + '(async function(){' + n.parameters.jsCode + '})', contexto(input, historico[nome]?.length ?? 0))
      output = await fn.call({ helpers: { getBinaryDataBuffer: async (index: number, field: string) => Buffer.from(input[index].binary![field].data, 'base64') } }) as Item[]
    } else if (n.type.endsWith('.if')) {
      const conditions = n.parameters.conditions as { conditions: { leftValue: string }[] }
      saida = avaliar(conditions.conditions[0].leftValue, input) ? 0 : 1
    } else if (n.type.endsWith('.splitInBatches')) {
      const acumulados: Item[] = []
      for (const item of input) {
        registrar(nome, [item], [item])
        expect(destinos(nome, 1)).toHaveLength(1)
        acumulados.push(...await seguir(destinos(nome, 1)[0].node, [item], true))
        lote++
      }
      output = acumulados
    } else if (n.type === 'n8n-nodes-evolution-api.evolutionApi') {
      const numeros = String(avaliar(n.parameters.numbers, input)).split(',')
      const tentativa = nome === 'Consultar novamente' ? 2 : 1
      consultas.push({ numeros, tentativa, lote })
      output = [{ json: op.resposta?.(numeros, tentativa, lote) ?? resposta(numeros) }]
    } else if (n.type.endsWith('.googleSheets')) {
      const range = String(avaliar(n.parameters.range, input))
      const id = Number(Object.keys(titulos).find(id => range.startsWith("'" + titulos[Number(id)] + "'")))
      expect(id, range).toBeGreaterThan(0)
      if (op.concorrente && nome === 'Reler backup') grades[10151005].push(['553133334444'])
      const values = structuredClone(grades[id])
      if (op.corromper === nome) values.push(['conteudo-extra'])
      output = [{ json: op.retorno?.[nome] ?? { values } }]
    } else if (n.type.endsWith('.googleDrive')) {
      const p = n.parameters
      if (p.operation === 'search') {
        const query = String(avaliar(p.queryString, input))
        const match = query.match(/name = '((?:\\.|[^'])*)'/)!
        const desescapar = (v: string) => v.replace(/\\(.)/g, '$1')
        const parent = desescapar(query.match(/^'((?:\\.|[^'])*)'/)![1])
        const name = desescapar(match[1])
        output = arquivos.filter(a => a.name === name && a.parents.includes(parent) && a.trashed === false).map(a => ({ json: { ...a } }))
        if (!output.length) output = [{ json: {} }]
      } else if (p.operation === 'create') {
        const a = { ...pasta, id: 'pasta-criada', name: String(avaliar(p.name, input)) }
        arquivos.push(a); output = [{ json: a }]
      } else if (p.operation === 'upload') {
        const rlc = p.folderId as { value: string }
        const a = { id: 'csv-' + arquivos.length, name: String(avaliar(p.name, input)), mimeType: 'text/csv',
          parents: [String(avaliar(rlc.value, input))], trashed: false,
          conteudo: Buffer.from(input[0].binary!.data.data, 'base64').toString('utf8') }
        arquivos.push(a); uploads.push(nome)
        if (op.uploadIncerto) throw new Error('resposta_upload_perdida')
        output = [{ json: { ...a } }]
      } else if (p.operation === 'download') {
        const rlc = p.fileId as { value: string }
        const a = arquivos.find(a => a.id === avaliar(rlc.value, input))!
        output = [{ json: op.downloadSemJson ? {} : input[0].json, binary: { data: { data: Buffer.from(op.corromper === nome ? 'divergente' : a.conteudo!).toString('base64') } } }]
      } else throw new Error('operacao_drive_inesperada')
    } else if (n.type.endsWith('.httpRequest')) {
      if (nome === 'Ler raiz Drive') output = [{ json: op.metaRaiz ?? { id: 'raiz-teste', name: 'CRM', mimeType: 'application/vnd.google-apps.folder', trashed: false, capabilities: { canAddChildren: true } } }]
      else if ((nome === 'Ler contexto Drive' || nome === 'Ler nota origem Drive')) output = [{ json: { sheets: [1,3].map(sheetId => ({ properties: { sheetId },
        data: [{ rowData: [{ values: [{ note: notas[sheetId] }] }] }] })) } }]
      else if (nome.startsWith('Ler pasta ') || nome.startsWith('Ler arquivo ')) {
        const id = String(avaliar(n.parameters.url, input)).split('/').at(-1)!
        const a = arquivos.find(a => a.id === id)
        if (!a) throw new Error('arquivo_ausente')
        output = [{ json: op.retorno?.[nome] ?? { ...a, size: a.conteudo === undefined ? undefined : String(Buffer.byteLength(a.conteudo)) } }]
      }
      else if (nome === 'Verificar conexão') output = [{ json: op.conexao ?? { statusCode: 200, body: { instance: { state: 'open' } } } }]
      else if (nome === 'Ler metadados') output = [{ json: { sheets: Object.entries(titulos).map(([id, title]) => ({
        properties: { sheetId: Number(id), title: id === '10151005' ? op.tituloBackup ?? title : title,
          gridProperties: dimensoes[Number(id)] },
      })) } }]
      else {
        const body = avaliar(n.parameters.jsonBody, input) as { requests: Json[] }
        batches.push({ nome, requests: body.requests })
        if (op.concorrenteNaGravacao && nome === 'Substituir saídas') grades[10151005].push(['553133334444'])
        for (const req of body.requests) {
          if (req.appendDimension) {
            const r = req.appendDimension as { sheetId: number; dimension: string; length: number }
            expect(r.dimension).toBe('ROWS')
            dimensoes[r.sheetId].rowCount += r.length
          }
          if (req.updateSheetProperties) {
            const r = req.updateSheetProperties as { properties: { sheetId: number; gridProperties: { rowCount: number; columnCount: number } } }
            dimensoes[r.properties.sheetId] = r.properties.gridProperties
          }
          if (req.repeatCell) {
            const r = req.repeatCell as { fields: string; range: { sheetId: number; startColumnIndex?: number; endColumnIndex?: number } }
            if (r.fields === 'userEnteredValue') grades[r.range.sheetId] = []
          }
          if (req.updateCells) {
            const r = req.updateCells as { fields: string; range: { sheetId: number; startRowIndex?: number; endRowIndex?: number; endColumnIndex: number };
              rows: { values: { note?: string; userEnteredValue?: { stringValue: string } }[] }[] }
            if (r.fields === 'note') { notas[r.range.sheetId] = r.rows[0].values[0].note!; continue }
            if (r.fields !== 'userEnteredValue') continue
            const start = r.range.startRowIndex ?? 0
            const dim = dimensoes[r.range.sheetId]
            if (start + r.rows.length > dim.rowCount || r.range.endColumnIndex > dim.columnCount) throw new Error('grade_insuficiente')
            r.rows.forEach((linha, i) => { grades[r.range.sheetId][start + i] = linha.values.map(c => c.userEnteredValue!.stringValue) })
          }
          if (req.appendCells) {
            const r = req.appendCells as { sheetId: number; fields: string; rows: { values: { userEnteredValue: { stringValue: string } }[] }[] }
            expect(r.fields).toBe('userEnteredValue')
            while (grades[r.sheetId].length && grades[r.sheetId].at(-1)!.every(v => v === '' || v === null || v === undefined)) grades[r.sheetId].pop()
            grades[r.sheetId].push(...r.rows.map(l => l.values.map(c => c.userEnteredValue.stringValue)))
          }
        }
        output = [{ json: { spreadsheetId: config.planilhaId, replies: [] } }]
      }
    }
    registrar(nome, output, input)
    for (const d of destinos(nome, saida)) output = await seguir(d.node, output, noLoop)
    return output
  }
  try { return { resultado: await seguir('Coleta pronta', [{ json: { body: op.sinal === undefined ? sinal() : op.sinal, headers: { 'x-crm-token': 'segredo-teste' } } }]), vistos, consultas, batches, grades, notas, arquivos, uploads, erro: null } }
  catch (erro) { return { resultado: [] as Item[], vistos, consultas, batches, grades, notas, arquivos, uploads, erro: erro as Error } }
}


const contextoOrigem = { raizId: 'raiz-teste', pastaId: 'pasta-teste', bairro: 'Brás', cidade: 'São Paulo', uf: 'SP',
  dataColeta: '2026-10-16', lote: 'coleta-teste' }
function manifestoOrigem(matriz = fonte()): ManifestoDrive {
  const csv = criarCsvDrive(matriz)
  if (!csv.ok) throw new Error('fixture')
  return { ...contextoOrigem, versao: 1, tipo: 'origem', estado: 'salvo', arquivoId: 'original-teste',
    nome: 'original.csv', csvSha256: csv.csvSha256, linhas: csv.linhas }
}
function arquivoOriginal(matriz = fonte()): Arquivo {
  const r = criarCsvDrive(matriz)
  if (!r.ok) throw new Error('fixture')
  return { id: 'original-teste', name: 'original.csv', mimeType: 'text/csv', parents: ['pasta-teste'], trashed: false, conteudo: r.csv }
}
function pendencia() {
  const r = criarExportacaoDrive(contextoOrigem, anterior, { id: 'anterior', data: '2026-10-15T20:00:00.000Z' })
  if (!r.ok) throw new Error('fixture')
  return r
}
const sinal = (m = manifestoOrigem()) => ({ versao: 1 as const, lote: m.lote, origemCsvSha256: m.csvSha256, planilhaId: config.planilhaId, origemId: config.abas.origem, pastaId: m.pastaId, arquivoOriginalId: m.arquivoId! })
const opPublicada = (): Opcoes => ({ notaOrigem: escreverManifestoDrive('Humano origem',manifestoOrigem()), arquivos: [arquivoOriginal()] })
const semEfeitos = (r: Awaited<ReturnType<typeof percurso>>) => {
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
  expect(r.uploads).toEqual([])
}
const retomada = (r: Awaited<ReturnType<typeof percurso>>, extra: Opcoes = {}): Opcoes => ({ ...opPublicada(), anterior: r.grades[3], validacao: r.grades[2], backup: r.grades[10151005], notaExportacao: r.notas[3], arquivos: r.arquivos, execucaoId: 'retomada', ...extra })

test('exporta Webhook POST autenticado, resposta final objeto e sem trigger manual/credenciais', () => {
  const w = gerarWorkflowAutomatico(config)
  expect(w.nodes.find(n => n.name === 'Coleta pronta')).toMatchObject({ type: 'n8n-nodes-base.webhook', typeVersion: 2.1, parameters: { httpMethod: 'POST', path: config.webhookPath, authentication: 'headerAuth', responseMode: 'lastNode', responseData: 'firstEntryJson' } })
  expect(w.nodes.some(n => n.type.endsWith('.manualTrigger'))).toBe(false)
  expect(JSON.stringify(w)).not.toMatch(/"credentials"|"pinData"|segredo|\/message\//)
})
test.each([null, {}, { ...sinal(), planilhaId: 'outra' }, { ...sinal(), origemId: 99 }, { ...sinal(), token: 'segredo-nao-vazar' }])('corpo/destino inválido bloqueia todos os efeitos', async body => {
  const r = await percurso({ ...opPublicada(), sinal: body })
  expect(r.erro?.message).toBe('sinal_coleta_invalido')
  semEfeitos(r)
  expect(r.vistos).not.toContain('Ler nota origem Drive')
})
test.each(['lote','origemCsvSha256','pastaId','arquivoOriginalId'] as const)('sinal %s divergente bloqueia até a recuperação pendente', async campo => {
  const r = await percurso({ ...opPublicada(), sinal: { ...sinal(), [campo]: campo === 'origemCsvSha256' ? '0'.repeat(64) : 'outro' }, notaExportacao: escreverManifestoDrive('',pendencia().manifesto) })
  expect(r.erro?.message).toBe('publicacao_origem_divergente')
  semEfeitos(r)
  expect(r.vistos).not.toContain('Ler contexto Drive')
})
test('lote novo confere origem antes dos efeitos e devolve contrato exato persistindo assinatura', async () => {
  const r = await percurso(opPublicada())
  expect(r.erro).toBeNull()
  expect(r.uploads).toEqual(['Enviar CSV atual'])
  expect(r.resultado[0]?.json).toMatchObject({ versao: 1, estado: 'concluido', lote: sinal().lote, origemCsvSha256: sinal().origemCsvSha256, execucaoId: 'exec-teste', empresasLidas: 11, empresasExportadas: 10, validos: 10, invalidos: 0, pendencias: 0, mensagensEnviadas: 0, arquivoDrive: { pastaId: 'pasta-teste' } })
  expect(Object.keys(r.resultado[0].json).sort()).toEqual(['versao','estado','lote','origemCsvSha256','execucaoId','empresasLidas','empresasExportadas','validos','invalidos','pendencias','mensagensEnviadas','arquivoDrive'].sort())
  expect(r.notas[3]).toContain('CRM_AUTOMATICO_V1:')
  expect(r.notas[3]).toContain('Texto humano exportação')
  expect(r.notas[3]).toContain('CRM_DRIVE_V1:')
  expect(r.vistos.indexOf('Conferir publicação automática')).toBeLessThan(r.vistos.indexOf('Preservar backup'))
  expect(JSON.stringify(r.resultado)).not.toContain('segredo-teste')
})
test('repetição salva devolve resposta existente sem Drive/Evolution/escrita', async () => {
  const primeiro = await percurso(opPublicada())
  expect(primeiro.erro).toBeNull()
  const r = await percurso(retomada(primeiro))
  expect(r.erro).toBeNull()
  semEfeitos(r)
  expect(r.resultado[0]?.json).toEqual({ ...primeiro.resultado[0].json, estado: 'ja_concluido' })
  expect(r.vistos).not.toContain('Ler raiz Drive')
  expect(r.vistos).not.toContain('Ler backup')
  expect(r.arquivos).toEqual(primeiro.arquivos)
  expect(r.grades).toEqual(primeiro.grades)
})
test('legado 689 com cinco exportados e 19 números preserva dados e os dois CSVs', async () => {
  const original = manifestoOrigem(fonte(10))
  const exportadas = [header,...Array.from({ length: 5 },(_,i) => ['','','Loja '+i,'','112606000'+i,'','','','p'+i])]
  const exp = criarExportacaoDrive({ ...contextoOrigem },exportadas,{ id: '689', data: '2026-10-16T10:00:00.000Z' })
  if (!exp.ok) throw new Error('fixture')
  const m = { ...exp.manifesto, estado: 'salvo' as const, arquivoId: 'final-689' }
  const nota = escreverManifestoDrive('Humano\nExecução: 685\nData: 2026-10-15T10:00:00.000Z\nSituação: concluído\nválidos: 99\ninválidos: 99\nexportadas: 99\npendências: 0\nExecução: 689\nData: 2026-10-16T10:00:00.000Z\nSituação: concluído com pendências\nválidos: 5\ninválidos: 1\nexportadas: 5\npendências: 4',m)
  const backup = [['telefone'],...Array.from({ length: 19 },(_,i) => ['5511'+(26060000+i)])]
  const arquivos = [arquivoOriginal(fonte(10)),{ id: m.arquivoId, name: m.nome, mimeType: 'text/csv', parents: [m.pastaId], trashed: false, conteudo: exp.csv }]
  const r = await percurso({ fonte: fonte(10), sinal: sinal(original), notaOrigem: escreverManifestoDrive('',original), notaExportacao: nota, anterior: exportadas, backup, arquivos })
  expect(r.erro).toBeNull()
  semEfeitos(r)
  expect(r.resultado[0]?.json).toMatchObject({ estado: 'ja_concluido', execucaoId: '689', empresasLidas: 10, empresasExportadas: 5, validos: 5, invalidos: 1, pendencias: 4, arquivoDrive: { id: 'final-689' } })
  expect(r.grades[3]).toEqual(exportadas)
  expect(r.grades[10151005]).toEqual(backup)
  expect(r.notas[3]).toBe(nota)
  expect(r.arquivos.filter(a => a.conteudo)).toEqual(arquivos)
})
test('assinatura do mesmo lote com novo hash recusa antes de qualquer efeito', async () => {
  const primeiro = await percurso(opPublicada())
  const matriz = fonte(); matriz[1][1] = 'Empresa modificada'
  const origem = manifestoOrigem(matriz)
  const r = await percurso(retomada(primeiro,{ fonte: matriz, sinal: sinal(origem), notaOrigem: escreverManifestoDrive('',origem) }))
  expect(r.erro?.message).toBe('assinatura_origem_conflitante')
  semEfeitos(r)
})
test('mesmo lote pendente arquiva o resultado existente sem limpar/reconsultar', async () => {
  const primeiro = await percurso({ ...opPublicada(), falha: 'Enviar CSV atual' })
  expect(primeiro.erro?.message).toBe('transporte_indisponivel')
  const r = await percurso(retomada(primeiro))
  expect(r.erro).toBeNull()
  expect(r.uploads).toEqual(['Enviar CSV pendente'])
  expect(r.consultas).toEqual([])
  expect(r.vistos).not.toContain('Limpar saídas')
  expect(r.vistos).not.toContain('Preservar backup')
  expect(r.grades[3]).toEqual(primeiro.grades[3])
  expect(r.resultado[0]?.json).toMatchObject({ estado: 'ja_concluido', empresasExportadas: 10, execucaoId: 'exec-teste' })
})
test('upload incerto é reconciliado pelo arquivo já criado, sem segundo CSV nem consultas', async () => {
  const primeiro = await percurso({ ...opPublicada(), uploadIncerto: true })
  expect(primeiro.erro?.message).toBe('resposta_upload_perdida')
  const r = await percurso(retomada(primeiro))
  expect(r.erro).toBeNull()
  expect(r.uploads).toEqual([])
  expect(r.consultas).toEqual([])
  expect(r.arquivos).toEqual(primeiro.arquivos)
  expect(r.resultado[0]?.json.estado).toBe('ja_concluido')
})
test('outro lote pendente é recuperado na pasta anterior antes de processar o atual', async () => {
  const p = pendencia()
  const anteriorOutro = { ...p.manifesto, lote: 'coleta-anterior', pastaId: 'pasta-anterior' }
  const arquivos = [...opPublicada().arquivos!, { id: 'pasta-anterior', name: 'Pasta anterior', mimeType: 'application/vnd.google-apps.folder', parents: ['raiz-teste'], trashed: false }]
  const r = await percurso({ ...opPublicada(), arquivos, notaExportacao: escreverManifestoDrive('Humano anterior',anteriorOutro) })
  expect(r.erro).toBeNull()
  expect(r.uploads).toEqual(['Enviar CSV pendente','Enviar CSV atual'])
  expect(r.arquivos.find(a => a.name === p.manifesto.nome)?.parents).toEqual(['pasta-anterior'])
  const resultado = r.resultado[0]?.json.arquivoDrive as { id: string }
  expect(r.arquivos.find(a => a.id === resultado.id)?.parents).toEqual(['pasta-teste'])
  expect(r.vistos.indexOf('Concluir pendência Drive')).toBeLessThan(r.vistos.indexOf('Limpar saídas'))
  expect(r.vistos.indexOf('Concluir pendência Drive')).toBeLessThan(r.vistos.indexOf('Consultar WhatsApp'))
  expect(r.resultado[0]?.json.estado).toBe('concluido')
})
test('assinatura malformada bloqueia recuperação de outro lote antes de escrita', async () => {
  const p = pendencia()
  const r = await percurso({ ...opPublicada(), notaExportacao: escreverManifestoDrive('CRM_AUTOMATICO_V1:invalid',p.manifesto) })
  expect(r.erro?.message).toBe('assinatura_automatica_invalida')
  semEfeitos(r)
})
test.each(['', '../outro', 'x?token=segredo', '/publico', undefined, 1])('path inválido não gera webhook: %s', webhookPath => {
  expect(() => gerarWorkflowAutomatico({ ...config, webhookPath: webhookPath as string })).toThrow('Configuração inválida')
})
test('bundle automático funciona com isolamento e defineProperty neutralizado pelo runner seguro', async () => {
  const r = await percurso({ ...opPublicada(), seguro: true })
  expect(r.erro).toBeNull()
  expect(r.resultado[0]?.json).toMatchObject({ estado: 'concluido', empresasExportadas: 10 })
})
test('sem telefone mantém pendência e salva CSV dos demais sem impedir conclusão', async () => {
  const matriz = fonte(2); matriz[2][0] = ''
  const m = manifestoOrigem(matriz)
  const r = await percurso({ fonte: matriz, notaOrigem: escreverManifestoDrive('',m), sinal: sinal(m), arquivos: [arquivoOriginal(matriz)], backup: [['telefone']], anterior: [header] })
  expect(r.erro).toBeNull()
  expect(r.resultado[0]?.json).toMatchObject({ estado: 'concluido', empresasLidas: 2, empresasExportadas: 1, validos: 1, invalidos: 0, pendencias: 1 })
  const repetido = await percurso(retomada(r,{ fonte: matriz, notaOrigem: escreverManifestoDrive('',m), sinal: sinal(m) }))
  expect(repetido.erro).toBeNull()
  expect(repetido.resultado[0]?.json).toEqual({ ...r.resultado[0].json, estado: 'ja_concluido' })
  semEfeitos(repetido)
})
test('hash da matriz adulterada bloqueia antes de ler notas da exportação', async () => {
  const matriz = fonte(); matriz[1][1] = 'Outro valor'
  const r = await percurso({ ...opPublicada(), fonte: matriz })
  expect(r.erro?.message).toBe('publicacao_origem_divergente')
  expect(r.vistos).not.toContain('Ler contexto Drive')
  semEfeitos(r)
})
test('legado inconferível não reprocessa nem consulta arquivo', async () => {
  const p = pendencia()
  const m = { ...p.manifesto, estado: 'salvo' as const, arquivoId: 'arquivo-689' }
  const r = await percurso({ ...opPublicada(), notaExportacao: escreverManifestoDrive('Humano sem contagens',m) })
  expect(r.erro?.message).toBe('resultado_legado_inconferivel')
  expect(r.vistos).not.toContain('Ler raiz Drive')
  semEfeitos(r)
})
test('falha na recuperação de outro lote bloqueia novas consultas e limpeza', async () => {
  const p = pendencia()
  const r = await percurso({ ...opPublicada(), falha: 'Enviar CSV pendente', notaExportacao: escreverManifestoDrive('',{ ...p.manifesto, lote: 'outro-lote' }) })
  expect(r.erro?.message).toBe('transporte_indisponivel')
  expect(r.grades[3]).toEqual(anterior)
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
  expect(r.vistos).not.toContain('Limpar saídas')
})

test('variante automática desliga persistência mesmo se a base vier com histórico habilitado', () => {
  const gerarBase = driveModule.gerarWorkflowComDrive
  const espiao = vi.spyOn(driveModule,'gerarWorkflowComDrive').mockImplementationOnce(c => {
    const base = gerarBase(c)
    base.settings = { ...base.settings, saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all', saveManualExecutions: true, saveExecutionProgress: true }
    return base
  })
  try {
    const w = gerarWorkflowAutomatico(config)
    expect(w.settings).toMatchObject({ executionOrder: 'v1', timezone: 'America/Sao_Paulo', saveDataSuccessExecution: 'none', saveDataErrorExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false })
  } finally {
    espiao.mockRestore()
  }
})
