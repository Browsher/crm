import { expect, test, vi } from 'vitest'
import { instalarAlvo } from './instalar'
import type { WorkflowExport } from './workflow'

const config = { baseUrl: 'https://primary-production-04eb.up.railway.app', apiKey: 'chave-ficticia',
  workflowId: 'NxCO8HiaJmwqJ8jK', projectId: 'mIsmhrUTAVI1ZPnf', guardarAnterior: async () => {} }
const exportado: WorkflowExport = { name: 'Base', nodes: [], connections: {}, settings: { executionOrder: 'v1' } }
const atual = () => ({ id: config.workflowId, projectId: config.projectId, name: 'Original', active: false,
  updatedAt: '2026-10-14T12:00:00Z', nodes: [], connections: {}, settings: {} })
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
test('alvo diferente não faz nenhuma requisição', async () => {
  const http = vi.fn()
  expect(await instalarAlvo({ ...config, workflowId: 'outro' }, exportado, http))
    .toEqual({ ok: false, motivo: 'alvo_divergente' })
  expect(http).not.toHaveBeenCalled()
})
test('sem chave não tenta fabricar autenticação', async () => {
  const http = vi.fn()
  expect(await instalarAlvo({ ...config, apiKey: '' }, exportado, http)).toEqual({ ok: false, motivo: 'sem_acesso' })
})
test('401 termina sem mutação nem segredo no resultado', async () => {
  const http = vi.fn<typeof fetch>().mockResolvedValue(response({}, 401))
  const r = await instalarAlvo(config, exportado, http)
  expect(r).toEqual({ ok: false, motivo: 'sem_acesso' })
  expect(JSON.stringify(r)).not.toContain('chave-ficticia')
  expect(http.mock.calls.filter(c => c[1]?.method === 'PUT')).toHaveLength(0)
})
test('projeto divergente bloqueia a instalação', async () => {
  const http = vi.fn<typeof fetch>().mockResolvedValue(response({ ...atual(), projectId: 'outro' }))
  expect(await instalarAlvo(config, exportado, http)).toEqual({ ok: false, motivo: 'alvo_divergente' })
})
test('workflow ativo não vira formulário publicado automaticamente', async () => {
  const http = vi.fn<typeof fetch>().mockResolvedValue(response({ ...atual(), active: true }))
  expect(await instalarAlvo(config, exportado, http)).toEqual({ ok: false, motivo: 'alvo_ativo' })
})
test('alteração concorrente impede sobrescrever o grafo', async () => {
  const http = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response(atual()))
    .mockResolvedValueOnce(response({ ...atual(), updatedAt: '2026-10-14T12:01:00Z' }))
  expect(await instalarAlvo(config, exportado, http)).toEqual({ ok: false, motivo: 'alteracao_concorrente' })
})
test('PUT com erro não é declarado instalado', async () => {
  const http = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response(atual())).mockResolvedValueOnce(response(atual())).mockResolvedValueOnce(response({}, 500))
  expect(await instalarAlvo(config, exportado, http)).toEqual({ ok: false, motivo: 'verificacao_falhou' })
})
test('GET final deve comprovar exatamente o conteúdo gravado', async () => {
  const http = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response(atual())).mockResolvedValueOnce(response(atual()))
    .mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(atual()))
  expect(await instalarAlvo(config, exportado, http)).toEqual({ ok: false, motivo: 'verificacao_falhou' })
})
test('instala e preserva nome/estado com leitura posterior', async () => {
  const final = { ...atual(), settings: exportado.settings }
  const http = vi.fn<typeof fetch>().mockResolvedValueOnce(response(atual())).mockResolvedValueOnce(response(atual()))
    .mockResolvedValueOnce(response(final)).mockResolvedValueOnce(response(final))
  expect(await instalarAlvo(config, exportado, http)).toEqual({ ok: true, workflowId: config.workflowId })
  const put = http.mock.calls.find(c => c[1]?.method === 'PUT')
  expect(Object.keys(JSON.parse(String(put?.[1]?.body)))).toEqual(['name', 'nodes', 'connections', 'settings'])
  expect(http.mock.calls.every(c => c[1]?.redirect === 'error')).toBe(true)
})
