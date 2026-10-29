import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
import { gerarWorkflowComBackup } from './workflow-backup'
import { gerarWorkflowSimples } from './workflow-simples'

type Json = Record<string, unknown>
type Item = { json: Json; pairedItem?: { item: number } }
type Ligacao = { node: string; index: number }
const config = { planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test', instancia: 'loja / centro',
  abas: { origem: 1, validacao: 2, exportacao: 3 }, backupId: 10151005 }
const header = ['cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'telefone', 'email', 'cep', 'cnae_principal', 'google_place_id']
const fonte = (n = 11) => [['telefone', 'nome_empresa', 'place_id'],
  ...Array.from({ length: n }, (_, i) => ['11' + (26060000 + i), 'Loja ' + i, 'p' + i])]
const resposta = (numeros: string[]) => ({ success: true, data: numeros.map(number => ({ number, exists: true })) })
const anterior = [[...header], ['', '', 'Anterior', '', '(21) 2222-3333', '', '', '', 'anterior']]
const titulos: Record<number, string> = { 1: 'planilha original scraping', 2: 'Validar numero whatsapp',
  3: 'Planilha exportar CRM', 10151005: 'Backup telefones' }
type Opcoes = {
  fonte?: unknown[][]; backup?: unknown[][]; anterior?: unknown[][]; seguro?: boolean
  falha?: string; corromper?: string; concorrente?: boolean; concorrenteNaGravacao?: boolean; pequena?: boolean
  resposta?: (numeros: string[], tentativa: number, lote: number) => Json
  conexao?: Json; retorno?: Record<string, Json>; tituloBackup?: string
}

// Executa todo JavaScript exportado, com vínculo por item e loop reais. Só o
// transporte é sintético; as requests de Sheets alteram uma grade isolada.
async function percurso(op: Opcoes = {}) {
  const w = gerarWorkflowComBackup(config)
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
  let lote = 0
  const contexto = (input: Item[], runIndex = 0) => ({
    $input: { all: () => input, first: () => input[0] }, $json: input[0]?.json,
    $execution: { id: 'exec-teste' }, $runIndex: runIndex, Date,
    $: (nome: string) => ({ first: () => historico[nome]?.[0]?.[0],
      all: (...indices: number[]) => historico[nome]?.[indices[1] ?? 0] ?? [],
      itemMatching: (index: number) => vinculos.get(input[index])?.[nome] }),
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
      output = await fn() as Item[]
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
    } else if (n.type.endsWith('.httpRequest')) {
      if (nome === 'Verificar conexão') output = [{ json: op.conexao ?? { statusCode: 200, body: { instance: { state: 'open' } } } }]
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
              rows: { values: { userEnteredValue?: { stringValue: string } }[] }[] }
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
  try { return { resultado: await seguir('Iniciar manual', [{ json: {} }]), vistos, consultas, batches, grades, erro: null } }
  catch (erro) { return { resultado: [] as Item[], vistos, consultas, batches, grades, erro: erro as Error } }
}

test.each([false, true])('preserva anteriores antes de limpar, filtra histórico e publica novas reservas atomicamente; seguro=%s', async seguro => {
  const r = await percurso({ seguro })
  expect(r.erro).toBeNull()
  expect(r.consultas).toMatchObject([{ numeros: Array.from({ length: 10 }, (_, i) => '5511260600' + String(i + 1).padStart(2, '0')) }])
  expect(r.grades[10151005]).toEqual([['telefone'], ['551126060000'], ['552122223333'],
    ...Array.from({ length: 10 }, (_, i) => ['5511260600' + String(i + 1).padStart(2, '0')])])
  expect(r.grades[1]).toEqual(fonte())
  expect(r.grades[3][1]).toEqual(['', '', 'Loja 1', '', '1126060001', '', '', '', 'p1'])
  expect(r.resultado[0].json).toMatchObject({ empresasLidas: 11, empresasExportadas: 10,
    repetidosIgnorados: 1, totalBackup: 12, mensagensEnviadas: 0 })
  const ordem = ['Preservar backup', 'Conferir preservação', 'Limpar saídas', 'Consultar WhatsApp', 'Reler backup', 'Substituir saídas', 'Conferir saídas', 'Concluir notas']
  expect(ordem.map(n => r.vistos.indexOf(n))).toEqual([...ordem.map(n => r.vistos.indexOf(n))].sort((a, b) => a - b))
  expect(ordem.every(n => r.vistos.includes(n))).toBe(true)
  const final = r.batches.find(b => b.nome === 'Substituir saídas')!
  expect(new Set(final.requests.filter(x => x.updateCells || x.appendCells).map(x => x.updateCells
    ? (x.updateCells as { range: { sheetId: number } }).range.sheetId : (x.appendCells as { sheetId: number }).sheetId)))
    .toEqual(new Set([2, 3, 10151005]))
})

test('reexecução da mesma coleta reservada limpa sobras sem consultar Evolution', async () => {
  const r = await percurso({ backup: [['telefone'], ['+55 (11) 2606-0000']], fonte: fonte(1), anterior: [[...header]] })
  expect(r.erro).toBeNull()
  expect(r.consultas).toEqual([])
  expect(r.vistos).not.toContain('Verificar conexão')
  expect(r.grades[2]).toEqual([['Válidos', 'Inválidos']])
  expect(r.grades[3]).toEqual([header])
  expect(r.grades[10151005]).toEqual([['telefone'], ['+55 (11) 2606-0000']])
  expect(r.resultado[0].json).toMatchObject({ empresasLidas: 1, empresasExportadas: 0, repetidosIgnorados: 1, totalBackup: 1 })
})

test.each(['Preservar backup', 'Ler backup preservado'])('falha em %s conserva ambas as saídas anteriores e não consulta', async falha => {
  const r = await percurso({ falha })
  expect(r.erro?.message).toBe('transporte_indisponivel')
  expect(r.grades[3]).toEqual(anterior)
  expect(r.grades[2]).toEqual([['Válidos', 'Inválidos'], ['551121112222', '551121113333']])
  expect(r.consultas).toEqual([])
})

test.each([
  { backup: [['telefone'], ['ilegivel']], motivo: 'backup_invalido' },
  { anterior: [['errado']], motivo: 'exportacao_anterior_invalida' },
  { fonte: [['telefone', 'telefone']], motivo: 'estrutura_invalida' },
  { tituloBackup: 'Telefones', motivo: 'metadados_invalidos' },
])('dados inválidos interrompem antes de toda escrita: $motivo', async op => {
  const r = await percurso(op)
  expect(r.erro?.message).toContain(op.motivo)
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
})

test('readback de preservação divergente não limpa resultados anteriores', async () => {
  const r = await percurso({ corromper: 'Ler backup preservado' })
  expect(r.erro?.message).toContain('backup_alterado')
  expect(r.grades[3]).toEqual(anterior)
  expect(r.vistos).not.toContain('Limpar saídas')
})

test.each(['conexao', 'inconclusivo'] as const)('falha Evolution %s mantém saídas limpas e não reserva novos', async falha => {
  const r = await percurso(falha === 'conexao' ? { conexao: { error: 'segredo-api' } }
    : { resposta: () => ({ error: 'segredo-api' }) })
  expect(r.erro?.message).toContain(falha === 'conexao' ? 'instancia_desconectada' : 'consulta_incompleta')
  expect(r.erro?.message).not.toContain('segredo-api')
  expect(r.grades[2]).toEqual([['Válidos', 'Inválidos']])
  expect(r.grades[3]).toEqual([header])
  expect(r.grades[10151005]).toEqual([['telefone'], ['551126060000'], ['552122223333']])
  expect(JSON.stringify(r.batches.find(b => b.nome === 'Limpar saídas'))).toContain('incompleta')
  expect(r.vistos).not.toContain('Concluir notas')
})

test('alteração concorrente no histórico bloqueia a gravação final', async () => {
  const r = await percurso({ concorrente: true })
  expect(r.erro?.message).toContain('backup_alterado')
  expect(r.vistos).not.toContain('Substituir saídas')
  expect(r.grades[3]).toEqual([header])
})

test('acréscimo no intervalo entre conferência e publicação nunca é sobrescrito e impede sucesso', async () => {
  const r = await percurso({ concorrenteNaGravacao: true })
  expect(r.erro?.message).toContain('backup_alterado')
  expect(r.grades[10151005]).toContainEqual(['553133334444'])
  expect(r.vistos).not.toContain('Concluir notas')
  expect(r.vistos).not.toContain('Relatório final')
})

test.each(['Ler validação', 'Ler exportação', 'Ler backup final'])('leitura final divergente em %s impede notas e relatório de sucesso', async corromper => {
  const r = await percurso({ corromper })
  expect(r.erro?.message).toMatch(/gravacao_incompleta|backup_alterado/)
  expect(r.vistos).not.toContain('Concluir notas')
  expect(r.vistos).not.toContain('Relatório final')
})

test.each(['Ler backup', 'Ler exportação anterior', 'Ler backup preservado', 'Reler backup', 'Ler backup final'])('resposta nativa ilegível em %s interrompe sem expor transporte', async nome => {
  const r = await percurso({ retorno: { [nome]: { error: 'segredo-transporte' } } })
  expect(r.erro).not.toBeNull()
  expect(r.erro?.message).not.toContain('segredo-transporte')
  expect(r.vistos).not.toContain('Concluir notas')
})

test('backup e saídas ampliam grade sem perda, e negativos/cadastro pendente não são reservados', async () => {
  const r = await percurso({ pequena: true, fonte: [['telefone', 'nome_empresa', 'place_id'],
    ['(31) 3333-4444', 'Nova', 'pn'], ['(31) 3333-5555', 'Negativa', 'pneg'], ['(31) 3333-6666', '', 'pincompleto']],
  resposta: numeros => ({ success: true, data: numeros.map(number => ({ number, exists: number !== '553133335555' })) }) })
  expect(r.erro).toBeNull()
  expect(r.grades[10151005]).toEqual([['telefone'], ['551126060000'], ['552122223333'], ['553133334444']])
  expect(r.resultado[0].json).toMatchObject({ empresasExportadas: 1, validos: 2, invalidos: 1, totalBackup: 3 })
})

test('segundo lote repete somente inconclusivos e preserva respostas anteriores', async () => {
  const r = await percurso({ fonte: fonte(14), resposta: (numeros, tentativa, lote) => lote === 0 || tentativa === 2
    ? resposta(numeros) : { success: true, data: [{ number: numeros[0], exists: false }, { number: numeros[1], exists: true }] } })
  expect(r.erro).toBeNull()
  expect(r.consultas).toMatchObject([{ tentativa: 1, lote: 0 }, { tentativa: 1, lote: 1 },
    { tentativa: 2, lote: 1, numeros: ['551126060013'] }])
  expect(r.resultado[0].json).toMatchObject({ empresasExportadas: 12, invalidos: 1, mensagensEnviadas: 0 })
})

test('variante conserva contratos de consulta, formato e credenciais sem alterar o gerador simples', () => {
  const simples = gerarWorkflowSimples(config)
  const w = gerarWorkflowComBackup(config)
  expect(JSON.stringify(w)).not.toMatch(/"credentials"|"pinData"|\/message\//)
  expect(w.settings).toEqual(simples.settings)
  for (const nome of ['Consultar WhatsApp', 'Consultar novamente', 'Intervalo lote', 'Esperar tentativa', 'Loop lotes']) {
    expect(w.nodes.find(n => n.name === nome)?.parameters).toEqual(simples.nodes.find(n => n.name === nome)?.parameters)
  }
  expect(simples.nodes).toHaveLength(27)
  expect(w.nodes.filter(n => n.type.endsWith('.googleSheets')).every(n => n.parameters.rawData === true && n.onError === 'stopWorkflow')).toBe(true)
})

test.each([undefined, -1, 1, 2, 3, 2.1, Number.MAX_SAFE_INTEGER + 1])('backupId inválido ou colidente é recusado: %s', backupId => {
  expect(() => gerarWorkflowComBackup({ ...config, backupId: backupId as number })).toThrow('Configuração inválida')
})
