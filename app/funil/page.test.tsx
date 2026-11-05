import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ArquivoFunilRecente } from '@/src/lib/funil-arquivo'
import Pagina from './page'

const m = vi.hoisted(() => ({ exigir: vi.fn(), ler: vi.fn(), contar: vi.fn(), listar: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: m.exigir }))
vi.mock('@/src/features/funil/consulta', () => ({
  lerFunil: m.ler,
  contarSemInteresse: m.contar,
  listarSemInteresseFunil: m.listar,
  lerEmpresaArquivadaDaNegociacao: vi.fn(),
}))
vi.mock('@/src/components/crm/empresa-arquivada', () => ({ empresaArquivada: vi.fn() }))
vi.mock('./quadro', () => ({
  Quadro: ({ arquivos, negociacaoInicial }: { arquivos: ArquivoFunilRecente[]; negociacaoInicial: string | null }) =>
    <div><p>Quadro autorizado</p>{arquivos?.map(item => <p key={item.negociacaoId}>{item.nome}</p>)}{negociacaoInicial && <p>Selecionada: {negociacaoInicial}</p>}</div>,
}))

beforeEach(() => {
  vi.resetAllMocks()
  m.exigir.mockResolvedValue({ usuarioId: 'eu' })
  m.ler.mockResolvedValue([])
  m.listar.mockResolvedValue([])
})

test('gate de leitura de Sem interesse continua negando quadro quando lerFunil devolve vazio', async () => {
  m.contar.mockResolvedValue({ ok: false, motivo: 'sem_permissao' })
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({}) }))
  expect(html).toContain('role="alert"')
  expect(html).not.toContain('Quadro autorizado')
  expect(m.contar).toHaveBeenCalledWith('eu')
})

test('quadro autorizado recebe o arquivo recente do vendedor junto com a seleção inicial', async () => {
  m.contar.mockResolvedValue({ ok: true, total: 9 })
  m.listar.mockResolvedValue([{ empresaId: 'empresa', negociacaoId: 'encerrada', nome: 'Empresa recente', arquivadaEm: '2026-11-05T14:00:00Z', versao: 4 }])
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ negociacao: 'selecionada' }) }))
  expect(html).toContain('Quadro autorizado')
  expect(html).toContain('Empresa recente')
  expect(html).toContain('Selecionada: selecionada')
  expect(m.listar).toHaveBeenCalledWith('eu')
})
