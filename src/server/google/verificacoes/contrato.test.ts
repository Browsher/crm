import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
type No = { name: string; type: string; parameters: { jsCode?: string } }
const ler = async () => JSON.parse(await readFile('workflows/n8n/google/verificar-empresas.json', 'utf8')) as { active: boolean; nodes: No[]; connections: Record<string, unknown> }
test('há um único workflow inativo, com etapas condicionais e sem credenciais exportadas', async () => {
  const w = await ler()
  expect(w.active).toBe(false)
  expect(w.nodes.filter(n => n.type === 'n8n-nodes-base.webhook')).toHaveLength(2)
  expect(w.nodes.filter(n => n.type === 'n8n-nodes-base.respondToWebhook')).toHaveLength(2)
  expect(w.nodes.filter(n => n.type === 'n8n-nodes-base.if').length).toBeGreaterThanOrEqual(3)
  expect(JSON.stringify(w)).not.toContain('segredo-apenas-teste')
})
test('etapa de fixo confere formato sem afirmar que a linha está ativa', async () => {
  const w = await ler()
  const no = w.nodes.find(n => n.name === 'Conferir telefone fixo')!
  const entrada = { candidatas: [{ google_place_id: 'fixo', telefone: '1133334444' }, { google_place_id: 'celular', telefone: '11999998888' }], evidencias: [] }
  const saida = runInNewContext('(function(){' + no.parameters.jsCode + '})()', { $input: { first: () => ({ json: entrada }) }, Date, JSON })
  expect(saida[0].json.evidencias.map((e: {estado:string}) => e.estado)).toEqual(['aprovado', 'reprovado'])
  expect(saida[0].json.evidencias[0].motivo).toContain('Formato')
  expect(saida[0].json.evidencias[0].motivo).not.toContain('ativa')
})
