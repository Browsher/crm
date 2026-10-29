import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
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
  sobra?: 'validacao' | 'exportacao'
  retornoNativo?: Record<string, Json>
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
    } else if (n.type === 'n8n-nodes-base.googleSheets') {
      const range = avaliar(n.parameters.range, input)
      if (nome === 'Ler scraping') {
        expect(range).toBe("'planilha original scraping'!A1:AN100")
        const values = op.fonte ?? fonte(11)
        output = [{ json: values.length ? { values } : {} }]
      } else {
        const indice = nome === 'Ler validação' ? 0 : 1
        expect(range).toBe((op.rangesEsperados ?? [
          "'Validar numero whatsapp'!A1:AN100", "'Planilha exportar CRM'!A1:AN100",
        ])[indice])
        const values = structuredClone(grades[indice + 2])
        if (op.sobra === (indice === 0 ? 'validacao' : 'exportacao')) {
          const extra = Array<string>(40).fill('')
          extra[39] = 'sobra em coluna extra'
          values.push(extra)
        }
        output = [{ json: { values } }]
      }
      if (op.retornoNativo && nome in op.retornoNativo) output = [{ json: op.retornoNativo[nome] }]
    } else if (n.type.endsWith('.httpRequest')) {
      if (nome === 'Verificar conexão') output = [{ json: op.conexao ?? { statusCode: 200, body: { instance: { state: 'open' } } } }]
      else if (nome === 'Ler metadados') output = [{ json: op.metadata ?? { sheets: titulos.map((title, i) => ({
        properties: { sheetId: i + 1, title, gridProperties: { rowCount: 100, columnCount: 40 } },
      })) } }]
      else {
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
  expect(r.vistos).not.toContain('Ler scraping')
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
})

test('cabeçalho repetido é preservado pela leitura e bloqueia a coleta', async () => {
  const r = await percurso({ fonte: [['telefone', 'telefone'], ['1126061244', '1126061244']] })
  expect(r.erro?.message).toContain('estrutura_invalida')
  expect(r.batches).toEqual([])
})

test.each(['Ler metadados', 'Marcar processamento', 'Substituir saídas', 'Concluir notas'])('falha HTTP em %s impede relatório de sucesso', async falha => {
  const r = await percurso({ falha })
  expect(r.erro?.message).toBe('transporte_indisponivel')
  expect(r.vistos).not.toContain('Relatório final')
  if (falha !== 'Concluir notas') expect(r.vistos).not.toContain('Concluir notas')
})

test.each(['validacao', 'exportacao'] as const)('readback cobre colunas extras de %s e não conclui ao encontrar sobra', async sobra => {
  const r = await percurso({ sobra })
  expect(r.erro?.message).toContain('gravacao_incompleta')
  expect(r.vistos).not.toContain('Concluir notas')
  expect(r.vistos).not.toContain('Relatório final')
})
test('leituras comuns usam Google Sheets RAW v2 e somente operações conjuntas ficam no HTTP', () => {
  const w = gerarWorkflowSimples(config)
  expect(w.nodes).toHaveLength(27)
  const nativos = w.nodes.filter(n => n.type === 'n8n-nodes-base.googleSheets')
  expect(nativos.map(n => n.name)).toEqual(['Ler scraping', 'Ler validação', 'Ler exportação'])
  for (const n of nativos) {
    expect(n.typeVersion).toBe(2)
    expect(n.parameters).toMatchObject({ authentication: 'oAuth2', resource: 'sheet', operation: 'read',
      sheetId: 'sheet-cenario', rawData: true, dataProperty: 'values',
      options: { valueRenderMode: 'FORMATTED_VALUE', continue: true } })
    expect(n.parameters.options).not.toHaveProperty('timeout')
    expect(n.onError).toBe('stopWorkflow')
    expect(n.alwaysOutputData).toBe(true)
  }
  const http = w.nodes.filter(n => n.type.endsWith('.httpRequest'))
  expect(http.map(n => n.name)).toEqual(['Ler metadados', 'Verificar conexão', 'Marcar processamento', 'Substituir saídas', 'Concluir notas'])
  expect(JSON.stringify(http)).not.toMatch(/\/values\/|values:batchGet/)
  expect(w.connections['Substituir saídas']).toMatchObject({ main: [[{ node: 'Ler validação' }]] })
  expect(w.connections['Ler validação']).toMatchObject({ main: [[{ node: 'Ler exportação' }]] })
  expect(w.connections['Ler exportação']).toMatchObject({ main: [[{ node: 'Conferir saídas' }]] })
})

test.each(['Ler scraping', 'Ler validação', 'Ler exportação'])('falha nativa em %s bloqueia conclusão e relatório', async falha => {
  const r = await percurso({ falha })
  expect(r.erro?.message).toBe('transporte_indisponivel')
  expect(r.vistos).not.toContain('Concluir notas')
  expect(r.vistos).not.toContain('Relatório final')
  if (falha === 'Ler scraping') expect(r.batches).toEqual([])
})

test.each(['Ler validação', 'Ler exportação'].flatMap(nome => [
  { nome, retorno: {} }, { nome, retorno: { values: 'invalido' } },
  { nome, retorno: { values: ['linha invalida'] } }, { nome, retorno: { values: [] } },
  { nome, retorno: { error: 'segredo-transporte' } },
]))('retorno nativo inválido de $nome impede concluir notas: $retorno', async ({ nome, retorno }) => {
  const r = await percurso({ retornoNativo: { [nome]: retorno } })
  expect(r.erro?.message).toBe('gravacao_incompleta')
  expect(r.erro?.message).not.toContain('segredo-transporte')
  expect(r.vistos).not.toContain('Concluir notas')
  expect(r.vistos).not.toContain('Relatório final')
})

test.each([{}, { values: 'invalido' }, { values: ['linha invalida'] }, { error: 'segredo-transporte' }])('origem nativa malformada falha com diagnóstico estrutural', async retorno => {
  const r = await percurso({ retornoNativo: { 'Ler scraping': retorno } })
  expect(r.erro?.message).toContain('estrutura_invalida')
  expect(r.erro?.message).not.toContain('segredo-transporte')
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
})

test('origem totalmente vazia chega ao diagnóstico em vez de interromper silenciosamente', async () => {
  const r = await percurso({ fonte: [] })
  expect(r.erro?.message).toContain('A entrada deve ser uma matriz com cabeçalho.')
  expect(r.vistos).toContain('Preparar coleta')
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
})

test('leitura RAW preserva zeros e linha vazia intermediária na numeração original', async () => {
  const r = await percurso({ fonte: [
    ['telefone', 'nome_empresa', 'place_id', 'cep', 'coluna_extra'],
    ['1126061244', 'Loja', 'p1', '01234000', '00123'], [], ['abc', 'Outra', 'p2'],
  ] })
  expect(r.erro).toBeNull()
  const coleta = r.historico['Preparar coleta'][0][0].json.coleta as {
    linhas: { linha: number; dados: Json }[]
  }
  expect(coleta.linhas.map(l => l.linha)).toEqual([2, 4])
  expect(coleta.linhas[0].dados).toMatchObject({ cep: '01234000', coluna_extra: '00123' })
  expect(r.grades[3][1][6]).toBe('01234000')
  expect(r.resultado[0].json.pendencias).toMatchObject([{ linhas: [4] }])
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

test.each([false, true])('bundle bloqueia publicação integral quando CSV excede o orçamento; seguro=%s', async seguro => {
  const r = await percurso({ seguro, rangesEsperados: ["'Validar numero whatsapp'!A1:AN100", "'Planilha exportar CRM'!A1:AN5001"], fonte: [
    ['telefone', 'nome_empresa', 'place_id', 'razao_social', 'contato_nome'],
    ...Array.from({ length: 5000 }, (_, i) => ['1126060000', 'é"'.repeat(75), 'p' + i, 'r'.repeat(129), 'c'.repeat(39)]),
  ] })
  expect(r.erro?.message).toContain('exportacao_excede_tamanho')
  expect(r.erro?.message).toContain('Divida a coleta')
  expect(r.batches).toEqual([])
  expect(r.grades).toEqual({ 2: [['antigo'], ['sobra']], 3: [['antigo'], ['sobra']] })
  expect(r.vistos).not.toContain('Preparar publicação')
  expect(r.vistos).not.toContain('Relatório final')
})

test.each([
  { fonte: [['telefone'], ['1126061244', 'conteudo-privado']], detalhe: 'Valor sem cabeçalho na linha 2, coluna 2.' },
  { fonte: [['telefone', 'conteudo-privado', 'conteudo-privado']], detalhe: 'Cabeçalho duplicado na linha 1, coluna 3.' },
  { fonte: [['telefone'], [{ error: 'conteudo-privado' }]], detalhe: 'Célula ilegível na linha 2, coluna 1.' },
  { fonte: [['telefone', { error: 'conteudo-privado' }]], detalhe: 'Cabeçalho ilegível na linha 1, coluna 2.' },
])('Code node preserva diagnóstico estrutural sanitizado: %j', async ({ fonte, detalhe }) => {
  const r = await percurso({ fonte })
  expect(r.erro?.message).toContain(detalhe)
  expect(JSON.parse(r.erro!.message)).toEqual({ motivo: 'estrutura_invalida', detalhes: [detalhe] })
  expect(r.erro?.message).not.toContain('conteudo-privado')
  expect(r.batches).toEqual([])
  expect(r.consultas).toEqual([])
})
