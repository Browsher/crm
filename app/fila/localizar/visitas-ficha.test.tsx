import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'eu' }) }))
vi.mock('@/src/features/fila/consulta', () => ({ lerMinhasEmpresas: async () => ({ ok: true, carteira: [{ id: 'empresa' }] }) }))
vi.mock('@/src/features/contato/historico', () => ({ lerHistorico: async () => ({ ok: true, contatos: [] }) }))
vi.mock('../../carteira/[id]/ficha', () => ({ Ficha: () => null }))
vi.mock('./registrar-visita', () => ({ RegistrarVisita: ({ empresaId }: { empresaId: string }) => <span data-visita={empresaId} /> }))
test('ficha autorizada monta registro de visita', async () => {
  const { default: Pagina } = await import('../../carteira/[id]/page')
  expect(renderToStaticMarkup(await Pagina({ params: Promise.resolve({ id: 'empresa' }) }))).toContain('data-visita="empresa"')
})
