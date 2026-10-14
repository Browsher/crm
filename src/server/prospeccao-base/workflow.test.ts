import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
import { gerarWorkflow, type WorkflowConfig, type WorkflowExport } from './workflow'
import { serializarAbas } from '../../lib/prospeccao-base/abas'
import { consolidar } from '../../lib/prospeccao-base/consolidar'
import type { FonteMaps, Base } from '../../lib/prospeccao-base/modelo'

const config: WorkflowConfig = {
  planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test', instancia: 'cenario',
  abas: { Empresas: 1, Telefones: 2, Coletas: 3 },
}
const fonte = (place_id: string): FonteMaps => ({
  place_id, nome_empresa: 'Cenário ' + place_id, cnpj: '', telefone: '(11) 2606-1244',
  endereco: 'Rua do cenário, 10', link_maps: 'https://maps.google.com/',
})
type Item = { json: Record<string, unknown>; binary?: Record<string, unknown> }
async function code(w: WorkflowExport, name: string, input: Item[], named: Record<string, Item[]> = {}, bytes?: Uint8Array) {
  const node = w.nodes.find(n => n.name === name)
  if (!node) throw new Error('Nó ausente: ' + name)
  const fn = runInNewContext('(async function(){' + String(node.parameters.jsCode) + '})', {
    $input: { all: () => input, first: () => input[0] }, $json: input[0]?.json,
    $execution: { id: 'exec-teste' }, Date, TextDecoder,
    $: (nome: string) => ({
      all: () => named[nome] ?? [], first: () => named[nome]?.[0], item: named[nome]?.[0],
    }),
  })
  return await fn.call({ helpers: { getBinaryDataBuffer: async () => bytes } }) as Item[]
}
test('workflow manual só consulta registro e não exporta credenciais', () => {
  const w = gerarWorkflow(config)
  const json = JSON.stringify(w)
  expect(json).not.toContain('/message/')
  expect(json).not.toContain('credentials')
  expect(json).not.toContain('pinData')
  expect(w.settings).not.toHaveProperty('concurrency')
  expect(w.nodes.some(n => n.type === 'n8n-nodes-base.formTrigger')).toBe(true)
})
test('leitura seguinte recebe um item de controle e não repete a consulta por empresa', async () => {
  const w = gerarWorkflow(config)
  expect(await code(w, 'Controlar leitura Telefones', Array.from({ length: 45 }, () => ({ json: {} }))))
    .toHaveLength(1)
})
async function plano(base: Base, fontes: FonteMaps[]) {
  const w = gerarWorkflow(config)
  const abas = serializarAbas(base)
  const named: Record<string, Item[]> = {
    'Criar hash coleta': [{ json: { fontes, coleta_hash: 'a'.repeat(64), fonte: 'Google Maps', regiao: 'Mooca', termos: ['CFTV'],
      arquivo: 'cenario.csv', data: '2026-10-14', execucaoId: 'exec-teste' } }],
    'Ler Empresas': abas.Empresas.map(json => ({ json })),
    'Ler Telefones': abas.Telefones.map(json => ({ json })),
    'Ler Coletas': abas.Coletas.map(json => ({ json })),
  }
  const out = await code(w, 'Consolidar dados', [{ json: {} }], named)
  return { w, out, named }
}
test('novo telefone compartilhado conserva duas empresas e consulta única', async () => {
  const { out } = await plano({ empresas: [], telefones: [], coletas: [] }, [fonte('p1'), fonte('p2')])
  const p = out[0].json as { base: Base; lotes: { numeros: string[] }[] }
  expect(p.base.empresas).toHaveLength(2)
  expect(p.base.telefones).toHaveLength(1)
  expect(p.lotes).toEqual([{ numeros: ['551126061244'] }])
})
test('lista já validada chega ao relatório sem reconsultar os números', async () => {
  const r = consolidar({ empresas: [], telefones: [], coletas: [] }, [fonte('p1')], {
    id: 'a'.repeat(64), sha256: 'a'.repeat(64), execucaoId: 'antiga', fonte: 'Maps',
    regiao: 'Mooca', termos: [], data: '2026-10-14', arquivo: 'cenario.csv',
  })
  if (!r.ok) throw new Error(r.motivo)
  r.base.telefones[0].estado = 'encontrado'
  const { w, out } = await plano(r.base, [fonte('p1')])
  expect(out[0].json.lotes).toEqual([])
  const lotes = await code(w, 'Preparar lotes', out, { 'Consolidar dados': out })
  expect(lotes).toEqual([{ json: { _vazio: true } }])
})
test('lotes de números novos não ultrapassam dez', async () => {
  const fontes = Array.from({ length: 23 }, (_, i) => ({ ...fonte('p' + i), telefone: '11' + String(26060000 + i) }))
  const { out } = await plano({ empresas: [], telefones: [], coletas: [] }, fontes)
  expect((out[0].json.lotes as { numeros: string[] }[]).map(l => l.numeros.length)).toEqual([10, 10, 3])
})
test('releitura duplicada bloqueia relatório de sucesso', async () => {
  const { w, out } = await plano({ empresas: [], telefones: [], coletas: [] }, [fonte('p1')])
  const abas = serializarAbas(out[0].json.base as Base)
  const named: Record<string, Item[]> = { 'Consolidar dados': out,
    'Conferir Empresas': abas.Empresas.map(json => ({ json })),
    'Conferir Telefones': [...abas.Telefones, ...abas.Telefones].map(json => ({ json })),
    'Conferir Coletas': abas.Coletas.map(json => ({ json })),
  }
  await expect(code(w, 'Relatorio final', [{ json: {} }], named)).rejects.toThrow('base_invalida')
})
test('falha de escrita interrompe o grafo, sem caminho de continuar para sucesso', () => {
  const w = gerarWorkflow(config)
  for (const n of w.nodes.filter(n => n.type === 'n8n-nodes-base.googleSheets' && n.parameters.operation === 'appendOrUpdate')) {
    expect(n.onError ?? 'stopWorkflow').toBe('stopWorkflow')
  }
})

test('classificação no Code node conserva vínculos e erro não vira negativo', async () => {
  const { w, out } = await plano({ empresas: [], telefones: [], coletas: [] }, [fonte('p1'), fonte('p2')])
  const named: Record<string, Item[]> = {
    'Consolidar dados': out,
    'Loop lotes': [{ json: { numeros: ['551126061244'] } }],
    'Verificar conexao': [{ json: { statusCode: 200, body: { instance: { state: 'open' } } } }],
  }
  const r = await code(w, 'Classificar consulta', [{ json: { statusCode: 429, body: [] } }], named)
  expect(r[0].json.whatsapp).toBe('inconclusivo')
  expect(JSON.parse(String(r[0].json.empresas_ids))).toEqual(['google:p1', 'google:p2'])
})
test('validação do upload recusa cabeçalhos duplicados antes de acessar planilha', async () => {
  const w = gerarWorkflow(config)
  const bytes = new TextEncoder().encode('place_id,place_id\np1,p2\n')
  await expect(code(w, 'Validar arquivo', [{ json: {}, binary: { csv: {} } }], {}, bytes))
    .rejects.toThrow('Cabecalho invalido')
})
test('validação do upload recusa UTF-8 inválido', async () => {
  const w = gerarWorkflow(config)
  await expect(code(w, 'Validar arquivo', [{ json: {}, binary: { csv: {} } }], {}, new Uint8Array([0xff])))
    .rejects.toThrow()
})