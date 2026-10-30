import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import Pagina from './page'
import Detalhe from './[id]/page'
import type { ResultadoGrupo } from '@/src/features/empresas/grupos'
const deps = vi.hoisted(() => ({ listar: vi.fn(), detalhe: vi.fn(), exigir: vi.fn() }))
vi.mock('@/src/features/empresas/grupos', async original => ({ ...await original<object>(), listarGrupos: deps.listar, detalharGrupo: deps.detalhe }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: deps.exigir }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404') } }))
vi.mock('./acoes', () => ({ alterarGrupoAcao: vi.fn(), atualizarMetadadosGrupoAcao: vi.fn() }))
const grupo = { id: '11111111-1111-4111-8111-111111111111', nome: 'Base de testes', ativo: true, arquivoNome: null, autor: null, criadoEm: '2026-09-14T12:00:00Z', total: 60, descricao: null, origem: null, criterios: null }
beforeEach(() => {
  deps.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  deps.listar.mockResolvedValue({ ok: true, grupos: [grupo], resumo: { total: 51, ativos: 49, desativados: 2, empresas: 300 } })
  deps.detalhe.mockResolvedValue({ ok: true, grupo, contagens: { total: 60, disponiveis: 20, carteiras: 10, reservadas: 10, outros: 20 }, impactoDesativacao: 8, empresas: [{ id: 'empresa', cnpj: '11222333000181', razaoSocial: 'Empresa real', nomeFantasia: null, situacao: 'disponivel', responsavel: 'José', responsavelAtivo: false, reservadoPor: null, reservadoAte: null, elegivelEm: null, outrosGrupos: [{ id: 'outro', nome: 'Outro grupo', ativo: true }] }] } satisfies ResultadoGrupo)
})
test('lista compacta usa totais globais, origem migrada e navegação real', async () => {
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({}) }))
  expect(html).toContain('<table')
  expect(html).toContain('300')
  expect(html).toContain('Cadastros anteriores')
  expect(html).toContain('Migração')
  expect(html).not.toContain('/empresas/importar')
  expect(html).toContain('href="/empresas"')
  expect(html).toContain('/empresas/grupos?pagina=2')
})
test('estado vazio orienta consultar as coletas sem oferecer importação manual', async () => {
  deps.listar.mockResolvedValue({ ok: true, grupos: [], resumo: { total: 0, ativos: 0, desativados: 0, empresas: 0 } })
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({}) }))
  expect(html).toContain('Nenhuma lista')
  expect(html).not.toContain('/empresas/importar')
  expect(html).not.toContain('Importe uma planilha')
  expect(html).toContain('href="/empresas/google"')
})

test('página além do fim orienta voltar sem apresentar a base como vazia', async () => {
  deps.listar.mockResolvedValue({ ok: true, grupos: [], resumo: { total: 51, ativos: 49, desativados: 2, empresas: 300 } })
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ pagina: '3' }) }))
  expect(html).toContain('Nenhuma lista nesta página')
  expect(html).toContain('Volte à primeira página para consultar as listas existentes.')
  expect(html).not.toContain('Importe uma planilha ou consulte as coletas do Google.')
  expect(html).toContain('href="/empresas/grupos"')
  expect(html).toContain('300')
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


test('detalhe usa nome comercial conhecido e CNPJ não informado', async () => {
  const atual = await deps.detalhe()
  deps.detalhe.mockResolvedValue({ ...atual, empresas: [{ ...atual.empresas[0], cnpj: null, razaoSocial: null, nomeFantasia: 'Câmeras Aurora' }] })
  const html = renderToStaticMarkup(await Detalhe({ params: Promise.resolve({ id: grupo.id }), searchParams: Promise.resolve({}) }))
  expect(html).toContain('<strong>Câmeras Aurora</strong>')
  expect(html).toContain('Não informado')
})


test('detalhe de lista antiga exibe origem não informada e permite corrigir contexto', async () => {
  const html = renderToStaticMarkup(await Detalhe({ params: Promise.resolve({ id: grupo.id }), searchParams: Promise.resolve({}) }))
  expect(html).toContain('Origem não informada')
  expect(html).toContain('Salvar contexto')
})
