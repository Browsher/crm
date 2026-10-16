import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
import { gerarWorkflowComDrive } from './workflow-drive'
import { gerarWorkflowComBackup } from './workflow-backup'
import { criarCsvDrive, criarExportacaoDrive, escreverManifestoDrive, lerManifestoDrive, type ManifestoDrive } from '../../lib/prospeccao-base/arquivos-drive'
import { gerarWorkflowSimples } from './workflow-simples'

type Json = Record<string, unknown>
type Item = { binary?: Record<string, { data: string }>; json: Json; pairedItem?: { item: number } }
type Ligacao = { node: string; index: number }
const config = { planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test', instancia: 'loja / centro',
  abas: { origem: 1, validacao: 2, exportacao: 3 }, backupId: 10151005, driveRaizId: 'raiz-teste' }
const header = ['cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'telefone', 'email', 'cep', 'cnae_principal', 'google_place_id']
const fonte = (n = 11) => [['telefone', 'nome_empresa', 'place_id', 'bairro', 'cidade', 'data_coleta'],
  ...Array.from({ length: n }, (_, i) => ['11' + (26060000 + i), 'Loja ' + i, 'p' + i, 'Brás', 'São Paulo', '2026-10-16'])]
const resposta = (numeros: string[]) => ({ success: true, data: numeros.map(number => ({ number, exists: true })) })
const anterior = [[...header], ['', '', 'Anterior', '', '(21) 2222-3333', '', '', '', 'anterior']]
const titulos: Record<number, string> = { 1: 'planilha original scraping', 2: 'Validar numero whatsapp',
  3: 'Planilha exportar CRM', 10151005: 'Backup telefones' }
type Arquivo = { id: string; name: string; mimeType: string; parents: string[]; trashed: boolean; conteudo?: string }
type Opcoes = {
  isolarNos?: boolean; downloadSemJson?: boolean; notaOrigem?: string; notaExportacao?: string; arquivos?: Arquivo[]; uploadIncerto?: boolean; metaRaiz?: Json; execucaoId?: string; fonte?: unknown[][]; backup?: unknown[][]; anterior?: unknown[][]; seguro?: boolean
  falha?: string; corromper?: string; concorrente?: boolean; concorrenteNaGravacao?: boolean; pequena?: boolean
  resposta?: (numeros: string[], tentativa: number, lote: number) => Json
  conexao?: Json; retorno?: Record<string, Json>; tituloBackup?: string
}

// Executa todo JavaScript exportado, com vínculo por item e loop reais. Só o
// transporte é sintético; as requests de Sheets alteram uma grade isolada.
async function percurso(op: Opcoes = {}) {
  const w = gerarWorkflowComDrive(config)
  const historico: Record<string, Item[][]> = {}
  const vinculos = new WeakMap<Item, Record<string, Item>>()
  const vistos: string[] = []
  const consultas: { numeros: string[]; tentativa: number; lote: number }[] = []
  const batches: { nome: string; requests: Json[] }[] = []
  const grades: Record<number, unknown[][]> = { 1: structuredClone(op.fonte ?? fonte()),
    2: [['Válidos', 'Inválidos'], ['551121112222', '551121113333']],
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
  const isolar = <T>(v: T): T => op.isolarNos ? structuredClone(v) : v
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
  try { return { resultado: await seguir('Iniciar manual', [{ json: {} }]), vistos, consultas, batches, grades, notas, arquivos, uploads, erro: null } }
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
test.each([false,true])('salva CSV após conferir saídas e backup, com JS real; seguro=%s', async seguro => {
  const r = await percurso({ seguro })
  expect(r.erro).toBeNull()
  expect(r.uploads).toEqual(['Enviar CSV atual'])
  const arquivo = r.arquivos.find(a => a.conteudo)!
  const csv = criarCsvDrive(r.grades[3])
  expect(csv.ok && arquivo.conteudo).toBe(csv.ok && csv.csv)
  expect(arquivo.conteudo).toContain('"1126060001"')
  expect(lerManifestoDrive(r.notas[3], 'raiz-teste')).toMatchObject({ ok: true, manifesto: { estado: 'salvo', arquivoId: arquivo.id } })
  expect(r.resultado[0].json).toMatchObject({ empresasExportadas: 10, mensagensEnviadas: 0, origemManualSemUf: true,
    arquivoDrive: { id: arquivo.id, link: 'https://drive.google.com/file/d/' + arquivo.id + '/view' } })
  expect(r.vistos.indexOf('Conferir saídas')).toBeLessThan(r.vistos.indexOf('Enviar CSV atual'))
  expect(r.vistos.indexOf('Conferir CSV atual')).toBeLessThan(r.vistos.indexOf('Concluir notas'))
  const b = r.batches.find(b => b.nome === 'Substituir saídas')!
  expect(JSON.stringify(b.requests)).toContain('CRM_DRIVE_V1:')
  const notas = b.requests.map(req => req.updateCells as { fields?: string; rows: { values: { note?: string }[] }[] })
    .filter(req => req?.fields === 'note')
  expect(lerManifestoDrive(notas.at(-1)!.rows[0].values[0].note, 'raiz-teste')).toMatchObject({ manifesto: { estado: 'pendente' } })
})
test('raiz inválida bloqueia toda escrita, consultas e leituras da lista', async () => {
  const r = await percurso({ metaRaiz: { id: 'outra' } })
  expect(r.erro?.message).toBe('raiz_drive_invalida')
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
  expect(r.vistos).not.toContain('Ler scraping')
})
test('manifesto da origem confere extras e original antes de limpar', async () => {
  const r = await percurso({ notaOrigem: escreverManifestoDrive('Humano', manifestoOrigem()), arquivos: [arquivoOriginal()] })
  expect(r.erro).toBeNull()
  expect(r.vistos.indexOf('Conferir original Drive')).toBeLessThan(r.vistos.indexOf('Limpar saídas'))
  expect(r.resultado[0].json.origemManualSemUf).toBe(false)
})
test.each(['Enviar CSV atual','Baixar CSV atual','Ler arquivo atual'])('falha em %s preserva saída/backup e deixa manifesto pendente', async falha => {
  const r = await percurso({ falha })
  expect(r.erro?.message).toBe('transporte_indisponivel')
  expect(r.grades[3]).toHaveLength(11)
  expect(r.grades[10151005]).toHaveLength(13)
  expect(lerManifestoDrive(r.notas[3], 'raiz-teste')).toMatchObject({ manifesto: { estado: 'pendente' } })
  expect(r.vistos).not.toContain('Concluir notas')
})
test('recupera exportação pendente de outra origem antes de limpar e consultar', async () => {
  const p = pendencia()
  const r = await percurso({ notaExportacao: escreverManifestoDrive('Humano anterior', p.manifesto) })
  expect(r.erro).toBeNull()
  expect(r.uploads).toEqual(['Enviar CSV pendente','Enviar CSV atual'])
  expect(r.arquivos.find(a => a.name === p.manifesto.nome)?.conteudo).toBe(p.csv)
  expect(r.vistos.indexOf('Concluir pendência Drive')).toBeLessThan(r.vistos.indexOf('Ler scraping'))
  expect(r.vistos.indexOf('Concluir pendência Drive')).toBeLessThan(r.vistos.indexOf('Limpar saídas'))
})
test('upload incerto é recuperado sem duplicação nem reconsulta para recuperar', async () => {
  const falhou = await percurso({ uploadIncerto: true })
  expect(falhou.erro?.message).toBe('resposta_upload_perdida')
  const r = await percurso({ anterior: falhou.grades[3], backup: falhou.grades[10151005],
    notaExportacao: falhou.notas[3], arquivos: falhou.arquivos, execucaoId: 'nova-execucao' })
  expect(r.erro).toBeNull()
  expect(r.uploads).toEqual(['Enviar CSV atual'])
  expect(r.consultas).toEqual([])
  const nota = lerManifestoDrive(falhou.notas[3], 'raiz-teste')
  if (nota.ok) expect(r.arquivos.filter(a => a.name === nota.manifesto!.nome)).toHaveLength(1)
})
test.each(['Enviar CSV pendente','Baixar CSV pendente','Ler pasta pendente'])('pendência não arquivável em %s bloqueia limpeza e consultas', async falha => {
  const r = await percurso({ falha, notaExportacao: escreverManifestoDrive('', pendencia().manifesto) })
  expect(r.erro).not.toBeNull()
  expect(r.grades[3]).toEqual(anterior)
  expect(r.vistos).not.toContain('Limpar saídas')
  expect(r.consultas).toEqual([])
})
test('hash da exportação pendente divergente bloqueia upload e limpeza', async () => {
  const r = await percurso({ notaExportacao: escreverManifestoDrive('', { ...pendencia().manifesto, csvSha256: 'f'.repeat(64) }) })
  expect(r.erro?.message).toBe('exportacao_drive_divergente')
  expect(r.batches).toEqual([])
  expect(r.uploads).toEqual([])
})
test.each(['pasta','bytes','ambiguo'])('arquivo determinístico %s divergente impede recuperação', async caso => {
  const p = pendencia()
  const a: Arquivo = { id: 'existente', name: p.manifesto.nome, parents: ['pasta-teste'], mimeType: 'text/csv', trashed: false, conteudo: p.csv }
  const r = await percurso({ notaExportacao: escreverManifestoDrive('', p.manifesto),
    arquivos: caso === 'ambiguo' ? [a, { ...a, id: 'duplicado' }] : [a],
    corromper: caso === 'bytes' ? 'Baixar CSV pendente' : undefined,
    retorno: caso === 'pasta' ? { 'Ler pasta pendente': { id: 'pasta-teste', mimeType: 'application/vnd.google-apps.folder', parents: ['outra'], trashed: false } } : undefined })
  expect(r.erro?.message).toMatch(/pasta_drive_invalida|arquivo_drive_divergente|arquivo_drive_ambiguo/)
  expect(r.uploads).toEqual([])
  expect(r.vistos).not.toContain('Limpar saídas')
})
test('nota antiga de outra matriz bloqueia antes de limpar e consultar', async () => {
  const r = await percurso({ notaOrigem: escreverManifestoDrive('', { ...manifestoOrigem(), csvSha256: '0'.repeat(64) }) })
  expect(r.erro?.message).toBe('origem_drive_divergente')
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
})
test('origem manual ambígua não é inferida pelo termo de busca', async () => {
  const m = fonte(2); m[2][3] = 'Pari'
  const r = await percurso({ fonte: m })
  expect(r.erro?.message).toBe('contexto_origem_ambiguo')
  expect(r.batches).toEqual([])
})
test('exportação sem empresas salva CSV com apenas cabeçalho', async () => {
  const r = await percurso({ fonte: fonte(1), anterior: [header] })
  expect(r.erro).toBeNull()
  expect(r.consultas).toEqual([])
  const csv = criarCsvDrive([header])
  expect(r.arquivos.find(a => a.conteudo)?.conteudo).toBe(csv.ok && csv.csv)
  expect(r.resultado[0].json.empresasExportadas).toBe(0)
})
test('saída lida divergente bloqueia arquivamento e conclusão', async () => {
  const r = await percurso({ corromper: 'Ler exportação' })
  expect(r.erro?.message).toBe('gravacao_incompleta')
  expect(r.uploads).toEqual([])
  expect(r.vistos).not.toContain('Concluir notas')
})
test('geradores legados conservam parâmetros, tamanho e códigos sem Drive', () => {
  const antes = gerarWorkflowComBackup(config)
  const simples = gerarWorkflowSimples(config)
  const w = gerarWorkflowComDrive(config)
  expect(JSON.stringify(antes)).not.toContain('CRM_DRIVE_V1:')
  expect(JSON.stringify(simples)).not.toContain('CRM_DRIVE_V1:')
  expect(gerarWorkflowComBackup(config)).toEqual(antes)
  for (const nome of ['Loop lotes','Consultar WhatsApp','Consultar novamente','Intervalo lote']) {
    expect(w.nodes.find(n => n.name === nome)?.parameters).toEqual(antes.nodes.find(n => n.name === nome)?.parameters)
  }
  expect(JSON.stringify(w)).not.toMatch(/"credentials"|"pinData"|\/message\//)
  expect(w.connections['Iniciar manual']).toMatchObject({ main: [[{ node: 'Ler raiz Drive' }]] })
})
test.each(['', '../outro', undefined, 1])('raiz inválida recusa configuração: %s', driveRaizId => {
  expect(() => gerarWorkflowComDrive({ ...config, driveRaizId: driveRaizId as string })).toThrow('Configuração inválida')
})

test('nós nativos usam seletor Drive válido e cada leitura de nota usa um range', () => {
  const w = gerarWorkflowComDrive(config)
  for (const n of w.nodes.filter(n => n.type.endsWith('.googleDrive') && ['upload','create'].includes(String(n.parameters.operation)))) {
    expect(n.parameters.driveId).toMatchObject({ value: 'My Drive', mode: 'list' })
  }
  for (const nome of ['Ler contexto Drive', 'Ler nota origem Drive']) {
    const n = w.nodes.find(n => n.name === nome)!
    const parametros = n.parameters.queryParameters as { parameters: { name: string }[] }
    expect(parametros.parameters.filter(p => p.name === 'ranges')).toHaveLength(1)
  }
})

test('download sem JSON não perde ID conferido nos metadados', async () => {
  const r = await percurso({ downloadSemJson: true })
  expect(r.erro).toBeNull()
  const arquivo = r.arquivos.find(a => a.conteudo)!
  expect(lerManifestoDrive(r.notas[3], 'raiz-teste')).toMatchObject({ ok: true, manifesto: { arquivoId: arquivo.id } })
  expect(r.resultado[0].json.arquivoDrive).toMatchObject({ id: arquivo.id })
})

test('transporte isolado entre Code nodes conclui manifesto com o ID salvo', async () => {
  const r = await percurso({ isolarNos: true })
  expect(r.erro).toBeNull()
  expect(lerManifestoDrive(r.notas[3], 'raiz-teste')).toMatchObject({ ok: true, manifesto: {
    estado: 'salvo', arquivoId: r.arquivos.find(a => a.conteudo)!.id } })
})

test('erro da origem manual informa os campos faltantes antes de qualquer limpeza', async () => {
  const r = await percurso({ fonte: [['telefone','nome_empresa'],['1126060001','Loja']] })
  expect(r.erro?.message).toContain('bairro')
  expect(r.erro?.message).toContain('cidade')
  expect(r.erro?.message).toContain('data_coleta')
  expect(r.batches).toEqual([])
})
