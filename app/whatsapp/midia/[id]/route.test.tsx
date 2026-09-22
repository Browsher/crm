import { beforeEach, expect, test, vi } from 'vitest'
import { GET } from './route'
import { usuarioAtual } from '@/src/server/autenticacao/guarda'
import { lerMidia } from '@/src/server/whatsapp/midia'
import { resolverFontes } from '@/src/server/whatsapp/consulta'
vi.mock('@/src/server/whatsapp/consulta', () => ({ resolverFontes: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ usuarioAtual: vi.fn() }))
vi.mock('@/src/server/whatsapp/midia', () => ({ lerMidia: vi.fn() }))
const sessao = { usuarioId: 'u', nome: 'Gestor', papel: 'gestor' as const, senhaProvisoriaPendente: false }
const pedir = () => GET(new Request('https://crm.example/whatsapp/midia/ABC?conversa=123%40lid'), { params: Promise.resolve({ id: 'ABC' }) })
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(resolverFontes).mockResolvedValue({ fontes: [{ id: 'piloto', nome: 'Teste', instancia: 'teste' }], opcoes: [], vendedores: [] })
})

test('fonte removida não consulta mídia nem recai no piloto', async () => {
  vi.mocked(usuarioAtual).mockResolvedValue(sessao as Awaited<ReturnType<typeof usuarioAtual>>)
  vi.mocked(resolverFontes).mockResolvedValue({ fontes: [], opcoes: [], vendedores: [] })
  const r = await GET(new Request('https://crm.example/whatsapp/midia/ABC?conversa=123%40lid&fonte=removida'), { params: Promise.resolve({ id: 'ABC' }) })
  expect(r.status).toBe(404)
  expect(lerMidia).not.toHaveBeenCalled()
})
test('nega anônimo, vendedor e senha provisória antes de consultar mídia', async () => {
  for (const [usuario, status] of [[null, 401], [{ ...sessao, papel: 'vendedor' }, 403], [{ ...sessao, senhaProvisoriaPendente: true }, 403]] as const) {
    vi.mocked(usuarioAtual).mockResolvedValue(usuario as Awaited<ReturnType<typeof usuarioAtual>>)
    expect((await pedir()).status).toBe(status)
  }
  expect(lerMidia).not.toHaveBeenCalled()
})
test('gestor recebe anexo privado sem nome capaz de injetar cabeçalhos', async () => {
  vi.mocked(usuarioAtual).mockResolvedValue(sessao as Awaited<ReturnType<typeof usuarioAtual>>)
  vi.mocked(lerMidia).mockResolvedValue({ ok: true, bytes: new Uint8Array([1, 2]), tipo: 'application/octet-stream', nome: 'orçamento.pdf', documento: true })
  const r = await pedir()
  expect(r.status).toBe(200)
  expect(r.headers.get('cache-control')).toBe('private, no-store')
  expect(r.headers.get('content-disposition')).toContain('attachment;')
  expect(r.headers.get('x-content-type-options')).toBe('nosniff')
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([1, 2]))
})
test('erro de infraestrutura não revela credenciais', async () => {
  vi.mocked(usuarioAtual).mockRejectedValue(new Error('segredo'))
  const r = await pedir()
  expect(r.status).toBe(503)
  expect(await r.text()).not.toContain('segredo')
})

test('valida pedido antes da Evolution e mantém erro de arquivo privado', async () => {
  vi.mocked(usuarioAtual).mockResolvedValue(sessao as Awaited<ReturnType<typeof usuarioAtual>>)
  const invalido = await GET(new Request('https://crm.example/whatsapp/midia/ABC?conversa=https://externo.example'), { params: Promise.resolve({ id: 'ABC' }) })
  expect(invalido.status).toBe(400)
  expect(lerMidia).not.toHaveBeenCalled()
  vi.mocked(lerMidia).mockResolvedValue({ ok: false, motivo: 'muito_grande' })
  const r = await pedir()
  expect(r.status).toBe(413)
  expect(r.headers.get('cache-control')).toBe('private, no-store')
})
