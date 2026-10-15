import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
import type { WorkflowNode } from './workflow'
import { gerarWorkflowSimples, type WorkflowSimplesConfig } from './workflow-simples'

type Json = Record<string, unknown>
type Item = { json: Json; pairedItem?: { item: number } }
type Ligacao = { node: string; index: number }
const config: WorkflowSimplesConfig = {
  planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test', instancia: 'loja / centro',
  abas: { origem: 1, validacao: 2, exportacao: 3 },
}
const titulos = ['planilha original scraping', 'Validar numero whatsapp', 'Planilha exportar CRM']
const header = ['cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'telefone', 'email', 'cep', 'cnae_principal', 'google_place_id']
const fonte = (n: number) => [['telefone', 'nome_empresa', 'place_id'],
  ...Array.from({ length: n }, (_, i) => ['11' + (26060000 + i), 'Loja ' + i, 'p' + i])]
const resposta = (numeros: string[], exists = true) => ({ success: true, data: numeros.map(number => ({ number, exists })) })

type Opcoes = {
  fonte?: unknown[][]
  seguro?: boolean
  falha?: string
  conexao?: Json
  resposta?: (numeros: string[], tentativa: number, lote: number) => Json
  metadata?: Json
  sobra?: boolean
  rangesEsperados?: string[]
}
// Simula somente transporte e despacho. Executa o JavaScript exportado, incluindo
// o bundle real. O vínculo por item é separado do contador de execuções de cada nó.
async function percurso(op: Opcoes = {}) {
  const w = gerarWorkflowSimples(config)
  const historico: Record<string, Item[][]> = {}
  const vinculos = new WeakMap<Item, Record<string, Item>>()
  const vistos: string[] = []
  const consultas: { numeros: string[]; tentativa: number; lote: number }[] = []
  const batches: { nome: string; requests: Json[] }[] = []
  const grades: Record<number, string[][]> = { 2: [['antigo'], ['sobra']], 3: [['antigo'], ['sobra']] }
  let lote = 0
  const contexto = (input: Item[], runIndex: number) => ({
    $input: { all: () => input, first: () => input[0] }, $json: input[0]?.json,
    $execution: { id: 'exec-teste' }, $runIndex: runIndex, Date,
    $: (nome: string) => ({
      first: () => historico[nome]?.[0]?.[0],
      all: (...indices: number[]) => historico[nome]?.[indices[1] ?? 0] ?? [],
      get item() { return vinculos.get(input[0])?.[nome] },
      itemMatching: (index: number) => vinculos.get(input[index])?.[nome],
    }),
  })
  const avaliar = (v: unknown, input: Item[]) => typeof v === 'string' && v.startsWith('={{')
    ? runInNewContext('(' + v.slice(3, -2) + ')', contexto(input, 0)) : v
  const queries = (n: WorkflowNode, input: Item[]) => {
    const p = n.parameters.queryParameters as { parameters?: { name: string; value: unknown }[] } | undefined
    const url = new URL(String(avaliar(n.parameters.url, input)))
    return [...url.searchParams].map(([name, value]) => ({ name, value }))
      .concat((p?.parameters ?? []).map(q => ({ name: q.name, value: avaliar(q.value, input) })))
  }
  const registrar = (nome: string, output: Item[], input: Item[]) => {
    historico[nome] ??= []
    historico[nome].push(output)
    for (const item of output) {
      const anterior = input[item.pairedItem?.item ?? 0]
      vinculos.set(item, { ...vinculos.get(anterior), [nome]: item })
    }
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
        const destino = destinos(nome, 1)
        expect(destino).toHaveLength(1)
        acumulados.push(...await seguir(destino[0].node, [item], true))
        lote++
      }
      output = acumulados
    } else if (n.type === 'n8n-nodes-evolution-api.evolutionApi') {
      const numeros = String(avaliar(n.parameters.numbers, input)).split(',')
      const tentativa = nome === 'Consultar novamente' ? 2 : 1
      consultas.push({ numeros, tentativa, lote })
      output = [{ json: op.resposta?.(numeros, tentativa, lote) ?? resposta(numeros) }]
    } else if (n.type.endsWith('.httpRequest')) {
      if (nome === 'Verificar conexão') output = [{ json: op.conexao ?? { statusCode: 200, body: { instance: { state: 'open' } } } }]
      else if (nome === 'Ler metadados') output = [{ json: op.metadata ?? { sheets: titulos.map((title, i) => ({
        properties: { sheetId: i + 1, title, gridProperties: { rowCount: 100, columnCount: 40 } },
      })) } }]
      else if (nome === 'Ler scraping') {
        expect(decodeURIComponent(String(avaliar(n.parameters.url, input)))).toContain("'planilha original scraping'!A1:AN100")
        expect(queries(n, input)).toContainEqual({ name: 'valueRenderOption', value: 'FORMATTED_VALUE' })
        output = [{ json: { values: op.fonte ?? fonte(11) } }]
      } else if (nome === 'Ler saídas') {
        expect(queries(n, input).filter(q => q.name === 'ranges').map(q => q.value)).toEqual(op.rangesEsperados ?? [
          "'Validar numero whatsapp'!A1:AN100", "'Planilha exportar CRM'!A1:AN100",
        ])
        const validacao = structuredClone(grades[2])
        if (op.sobra) validacao.push(['', '', 'sobra em coluna extra'])
        output = [{ json: { valueRanges: [{ values: validacao }, { values: grades[3] }] } }]
      } else {
        const body = avaliar(n.parameters.jsonBody, input) as { requests: Json[] }
        batches.push({ nome, requests: body.requests })
        for (const req of body.requests) {
          if (req.repeatCell) {
            const r = req.repeatCell as { range: { sheetId: number } }
            grades[r.range.sheetId] = []
          }
          if (req.updateCells) {
            const r = req.updateCells as { fields: string; range: { sheetId: number }; rows: { values: { userEnteredValue?: { stringValue: string } }[] }[] }
            if (r.fields === 'userEnteredValue') grades[r.range.sheetId] = r.rows.map(l => l.values.map(c => c.userEnteredValue!.stringValue))
          }
        }
        output = [{ json: { spreadsheetId: 'sheet-cenario', replies: [] } }]
      }
    }
    registrar(nome, output, input)
    for (const destino of destinos(nome, saida)) output = await seguir(destino.node, output, noLoop)
    return output
  }
  try {
    const resultado = await seguir('Iniciar manual', [{ json: {} }])
    return { resultado, vistos, consultas, batches, grades, historico, erro: null }
  } catch (erro) {
    return { resultado: [], vistos, consultas, batches, grades, historico, erro: erro as Error }
  }
}

test('entrada manual, transporte credenciado sem segredo e política de execução preservada', () => {
  const w = gerarWorkflowSimples(config)
  expect(w.nodes.some(n => n.type.endsWith('.manualTrigger'))).toBe(true)
  expect(w.nodes.some(n => n.type.endsWith('.formTrigger'))).toBe(false)
  expect(w.nodes.filter(n => n.type === 'n8n-nodes-evolution-api.evolutionApi')).toHaveLength(2)
  expect(JSON.stringify(w)).not.toMatch(/"credentials"|"pinData"|\/message\//)
  expect(w.settings).toEqual({ executionOrder: 'v1', timezone: 'America/Sao_Paulo', saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false })
  for (const n of w.nodes.filter(n => n.type.endsWith('.httpRequest'))) {
    expect(n.typeVersion).toBe(4.2)
    expect(n.parameters.authentication).toBe('predefinedCredentialType')
    expect(n.parameters.options).toMatchObject({ timeout: 15000, redirect: { redirect: { followRedirects: false } } })
    if (n.name === 'Verificar conexão') {
      expect(n.parameters.nodeCredentialType).toBe('evolutionApi')
      expect(n.parameters.url).toBe('https://evolution.test/instance/connectionState/loja%20%2F%20centro')
    } else {
      expect(n.parameters.nodeCredentialType).toBe('googleSheetsOAuth2Api')
      expect(n.onError ?? 'stopWorkflow').toBe('stopWorkflow')
    }
  }
  for (const n of w.nodes.filter(n => n.type === 'n8n-nodes-evolution-api.evolutionApi')) {
    expect(n.typeVersion).toBe(1)
    expect(n.parameters).toMatchObject({ resource: 'chat-api', operation: 'check-number', instanceName: 'loja%20%2F%20centro' })
  }
  expect(w.nodes.find(n => n.name === 'Loop lotes')?.parameters.batchSize).toBe(1)
  expect(w.nodes.find(n => n.name === 'Intervalo lote')?.parameters).toMatchObject({ amount: 0.75, unit: 'seconds' })
  expect(w.nodes.find(n => n.name === 'Esperar tentativa')?.parameters).toMatchObject({ amount: 2, unit: 'seconds' })
})

test.each([
  { ...config, evolutionUrl: 'http://evolution.test' },
  { ...config, evolutionUrl: 'https://usuario:senha@evolution.test' },
  { ...config, evolutionUrl: 'https://evolution.test?key=x' },
  { ...config, evolutionUrl: 'https://evolution.test#x' },
  { ...config, planilhaId: 'id/values' }, { ...config, planilhaId: 'id?x' },
  { ...config, abas: { origem: 1, validacao: 1, exportacao: 3 } },
  { ...config, abas: { origem: 1, validacao: -1, exportacao: 3 } },
  { ...config, abas: { origem: 1, validacao: 2.1, exportacao: 3 } },
  null, {},
])('configuração inválida não produz workflow: %j', invalida => {
  expect(() => gerarWorkflowSimples(invalida as WorkflowSimplesConfig)).toThrow('Configuração inválida')
})

test.each([false, true])('dois lotes íntegros chegam ao relatório e conservam positivos e negativos; seguro=%s', async seguro => {
  const r = await percurso({ seguro, resposta: (numeros, _t, lote) => resposta(numeros, lote === 0) })
  expect(r.erro).toBeNull()
  expect(r.consultas.map(c => c.numeros.length)).toEqual([10, 1])
  expect(r.resultado[0].json).toMatchObject({ execucao: 'exec-teste', empresasLidas: 11, empresasExportadas: 10,
    validos: 10, invalidos: 1, mensagensEnviadas: 0, pendencias: [], duplicadas: [], compartilhados: [] })
  expect(r.grades[2][1]).toEqual(['551126060000', '551126060010'])
  expect(r.grades[3][0]).toEqual(header)
  expect(r.grades[3][1]).toEqual(['', '', 'Loja 0', '', '1126060000', '', '', '', 'p0'])
  expect(r.batches.map(b => b.nome)).toEqual(['Marcar processamento', 'Substituir saídas', 'Concluir notas'])
  const executados = r.vistos.filter(n => gerarWorkflowSimples(config).nodes.find(node => node.name === n)?.type.endsWith('.code'))
  expect(new Set(executados)).toEqual(new Set(['Validar metadados', 'Preparar coleta', 'Preparar lotes', 'Conferir conexão',
    'Classificar primeira tentativa', 'Guardar resultado lote', 'Montar saídas', 'Preparar publicação', 'Conferir saídas', 'Relatório final']))
})

test('só o segundo lote repete; preserva positivos/negativos da primeira tentativa sem confundir runIndex', async () => {
  const r = await percurso({ fonte: fonte(13), seguro: true, resposta: (numeros, tentativa, lote) => {
    if (lote === 0 || tentativa === 2) return resposta(numeros)
    return { success: true, data: [{ number: numeros[0], exists: false }, { number: numeros[1], exists: true }] }
  } })
  expect(r.erro).toBeNull()
  expect(r.consultas).toMatchObject([
    { lote: 0, tentativa: 1 }, { lote: 1, tentativa: 1 },
    { lote: 1, tentativa: 2, numeros: ['551126060012'] },
  ])
  expect(r.resultado[0].json).toMatchObject({ validos: 12, invalidos: 1, empresasExportadas: 12 })
  expect(r.historico['Classificar segunda tentativa']).toHaveLength(1)
})

test('resposta duplicada ainda inconclusiva bloqueia publicação dos dois lotes', async () => {
  const r = await percurso({ resposta: (numeros, _tentativa, lote) => lote === 0 ? resposta(numeros)
    : { success: true, data: [{ number: numeros[0], exists: true }, { number: numeros[0], exists: false }], errorDetails: 'segredo-api' } })
  expect(r.erro?.message).toContain('consulta_incompleta')
  expect(r.erro?.message).toContain('551126060010')
  expect(r.erro?.message).not.toContain('segredo-api')
  expect(r.batches).toEqual([])
  expect(r.vistos).not.toContain('Relatório final')
})

test.each([{ statusCode: 200, body: { instance: { state: 'close' } } }, { error: 'segredo-api' }])('conexão indisponível impede consulta e publicação', async conexao => {
  const r = await percurso({ conexao })
  expect(r.erro?.message).toContain('instancia_desconectada')
  expect(r.erro?.message).toContain('551126060000')
  expect(r.erro?.message).not.toContain('segredo-api')
  expect(r.consultas).toEqual([])
  expect(r.batches).toEqual([])
})

test.each([
  { fonte: [['telefone', 'nome_empresa', 'place_id']], lidas: 0 },
  { fonte: [['telefone', 'nome_empresa', 'place_id'], ['abc', 'Loja', 'p1']], lidas: 1 },
])('sem elegíveis substitui dados antigos por cabeçalhos e não consulta', async ({ fonte, lidas }) => {
  const r = await percurso({ fonte })
  expect(r.erro).toBeNull()
  expect(r.consultas).toEqual([])
  expect(r.grades[2]).toEqual([['Válidos', 'Inválidos']])
  expect(r.grades[3]).toEqual([header])
  expect(r.resultado[0].json).toMatchObject({ empresasLidas: lidas, empresasExportadas: 0 })
  if (lidas) {
    expect(r.resultado[0].json.pendencias).toMatchObject([{ linhas: [2] }])
    expect(JSON.stringify(r.batches.at(-1))).toContain('concluído com pendências')
  }
})

test('metadata aponta para histórico ou título inesperado: bloqueia antes de escrever', async () => {
  const r = await percurso({ metadata: { sheets: titulos.map((title, i) => ({ properties: {
    sheetId: i + 1, title: i === 1 ? 'Telefones' : title, gridProperties: { rowCount: 100, columnCount: 40 },
  } })) } })
  expect(r.erro?.message).toContain('metadados_invalidos')
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
})

test('cabeçalho repetido é preservado pela leitura e bloqueia a coleta', async () => {
  const r = await percurso({ fonte: [['telefone', 'telefone'], ['1126061244', '1126061244']] })
  expect(r.erro?.message).toContain('estrutura_invalida')
  expect(r.batches).toEqual([])
})

test.each(['Marcar processamento', 'Substituir saídas', 'Ler saídas', 'Concluir notas'])('falha HTTP em %s impede relatório de sucesso', async falha => {
  const r = await percurso({ falha })
  expect(r.erro?.message).toBe('transporte_indisponivel')
  expect(r.vistos).not.toContain('Relatório final')
  if (falha !== 'Concluir notas') expect(r.vistos).not.toContain('Concluir notas')
})

test('readback cobre colunas extras e não conclui ao encontrar sobra', async () => {
  const r = await percurso({ sobra: true })
  expect(r.erro?.message).toContain('gravacao_incompleta')
  expect(r.vistos).not.toContain('Concluir notas')
  expect(r.vistos).not.toContain('Relatório final')
})
test('ranges de readback são codificados separadamente na URL, sem parâmetros de mesmo nome sobrescritos', async () => {
  const w = gerarWorkflowSimples(config)
  const n = w.nodes.find(n => n.name === 'Ler saídas')!
  const ranges = { validacao: "'Validar numero whatsapp'!A1:B12", exportacao: "'Planilha exportar CRM'!A1:I12" }
  const expressao = String(n.parameters.url)
  const url = new URL(expressao.startsWith('={{') ? runInNewContext('(' + expressao.slice(3, -2) + ')', {
    $: () => ({ first: () => ({ json: { ranges } }) }),
  }) : expressao)
  expect(url.searchParams.getAll('ranges')).toEqual([ranges.validacao, ranges.exportacao])
  expect(url.searchParams.get('valueRenderOption')).toBe('FORMATTED_VALUE')
})

test('grade pequena expande antes dos dados e releitura cobre a dimensão expandida', async () => {
  const r = await percurso({ metadata: { sheets: titulos.map((title, i) => ({ properties: {
    sheetId: i + 1, title, gridProperties: i === 0 ? { rowCount: 100, columnCount: 40 } : { rowCount: 1, columnCount: 1 },
  } })) }, rangesEsperados: ["'Validar numero whatsapp'!A1:B12", "'Planilha exportar CRM'!A1:I12"] })
  expect(r.erro).toBeNull()
  expect(r.batches[1].requests.slice(0, 2)).toEqual([
    { updateSheetProperties: { properties: { sheetId: 2, gridProperties: { rowCount: 12, columnCount: 2 } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } },
    { updateSheetProperties: { properties: { sheetId: 3, gridProperties: { rowCount: 12, columnCount: 9 } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } },
  ])
})