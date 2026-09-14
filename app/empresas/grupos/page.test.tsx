import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import Pagina from './page'
import Detalhe from './[id]/page'
import type { ResultadoGrupo } from '@/src/features/empresas/grupos'
const deps = vi.hoisted(() => ({ listar: vi.fn(), detalhe: vi.fn(), exigir: vi.fn() }))
vi.mock('@/src/features/empresas/grupos', async original => ({ ...await original<object>(), listarGrupos: deps.listar, detalharGrupo: deps.detalhe }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: deps.exigir }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404') } }))
vi.mock('./acoes', () => ({ alterarGrupoAcao: vi.fn() }))
const grupo = { id: '11111111-1111-4111-8111-111111111111', nome: 'Base de testes', ativo: true, arquivoNome: null, autor: null, criadoEm: '2026-09-14T12:00:00Z', total: 60 }
beforeEach(() => {
  deps.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  deps.listar.mockResolvedValue({ ok: true, grupos: [grupo], resumo: { total: 51, ativos: 49, desativados: 2, empresas: 300 } })
  deps.detalhe.mockResolvedValue({ ok: true, grupo, contagens: { total: 60, disponiveis: 20, carteiras: 10, reservadas: 10, outros: 20 }, impactoDesativacao: 8, empresas: [{ id: 'empresa', cnpj: '11222333000181', razaoSocial: 'Empresa real', situacao: 'disponivel', responsavel: 'José', responsavelAtivo: false, reservadoPor: null, reservadoAte: null, elegivelEm: null, outrosGrupos: [{ id: 'outro', nome: 'Outro grupo', ativo: true }] }] } satisfies ResultadoGrupo)
})
test('lista compacta usa totais globais, origem migrada e navegação real', async () => {
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({}) }))
  expect(html).toContain('<table')
  expect(html).toContain('300')
  expect(html).toContain('Cadastros anteriores')
  expect(html).toContain('Migração')
  expect(html).toContain('href="/empresas/importar"')
  expect(html).toContain('href="/empresas"')
  expect(html).toContain('/empresas/grupos?pagina=2')
})
test('estado vazio oferece importação', async () => {
  deps.listar.mockResolvedValue({ ok: true, grupos: [], resumo: { total: 0, ativos: 0, desativados: 0, empresas: 0 } })
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({}) }))
  expect(html).toContain('Nenhum grupo')
  expect(html).toContain('href="/empresas/importar"')
})
test('detalhe identifica responsável inativo, outras origens e paginação', async () => {
  const html = renderToStaticMarkup(await Detalhe({ params: Promise.resolve({ id: grupo.id }), searchParams: Promise.resolve({ pagina: '2', gruposPagina: '2' }) }))
  expect(html).toContain('José (inativo)')
  expect(html).toContain('Outro grupo')
  expect(html).toContain('Cadastros anteriores')
  expect(html).toContain('Migração')
  expect(html).toContain('gruposPagina=2')
  expect(html).toContain('/empresas/grupos?pagina=2')
})
test('recurso ausente vira 404', async () => {
  deps.detalhe.mockResolvedValue({ ok: false, motivo: 'nao_encontrado' })
  await expect(Detalhe({ params: Promise.resolve({ id: 'invalido' }), searchParams: Promise.resolve({}) })).rejects.toThrow('404')
})
