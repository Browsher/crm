// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Contato } from '@/src/features/contato/historico'
import Pagina from './page'
const mocks = vi.hoisted(() => ({ perfil: vi.fn(), historico: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'gestor' }) }))
vi.mock('@/src/features/empresas/perfil', () => ({ lerPerfilEmpresa: mocks.perfil }))
vi.mock('@/src/features/contato/historico', () => ({ lerHistorico: mocks.historico }))
vi.mock('@/src/features/google/repositorio', () => ({ repositorioGoogle: () => ({ historicoEmpresa: async () => [{ pedidoId: 'p', dia: '2026-10-01', vendedor: 'Coleta autorizada', nicho: 'Iluminação', situacao: 'entregue' }] }) }))
vi.mock('../socios-gestor', () => ({ SociosGestor: () => null }))
const nota = 'Conversa integral do gestor.\n'.repeat(50)
const contato: Contato = { id: 'c', tipo: 'tipo legado', nota, autor: null,
  criadoEm: new Date('2026-11-05T01:30:00Z'), proximoPasso: 'Passo histórico', proximoPassoData: '2026-10-01' }
beforeEach(() => {
  mocks.perfil.mockResolvedValue({ id: 'e', nome: 'Aurora', razaoSocial: 'Aurora', cnpj: null, telefone: null,
    situacao: 'arquivada', grupos: [], responsavel: null, proximoPasso: 'Agenda atual diferente', retorno: '2030-12-31',
    arquivo: { arquivadaEm: '2026-11-01T12:00:00Z', negociacoes: [{ id: 'n', etapa: 'primeiro_contato', vendedor: 'Autora anterior', encerramento: 'arquivamento_legado', encerradaEm: null }] } })
  mocks.historico.mockResolvedValue({ ok: true, contatos: [contato] })
})
async function renderizar() {
  const tela = document.createElement('div')
  tela.innerHTML = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ id: 'e' }), searchParams: Promise.resolve({ aba: 'historico' }) }))
  return tela
}
test('gestor usa histórico comum com nota integral, ausência explícita e data histórica sem agenda atual', async () => {
  const tela = await renderizar()
  const historico = tela.querySelector('[aria-label="Histórico comercial"]')!
  expect(historico).not.toBeNull()
  const registro = historico.querySelector('details')!
  expect(registro.open).toBe(false)
  expect(registro.querySelector('summary')?.textContent).toContain('tipo legado')
  expect(registro.querySelector('summary')?.textContent).toContain('Autor não informado')
  expect(registro.querySelector('summary')?.textContent).toContain('04/11/2026')
  expect(registro.textContent).toContain(nota)
  expect(registro.querySelector('time[datetime="2026-10-01"]')?.textContent).toBe('01/10/2026')
  expect(historico.textContent).not.toContain('Agenda atual diferente')
  expect(historico.textContent).not.toMatch(/atrasad|sistema/i)
  expect(tela.textContent).toContain('Arquivamento e negociações')
  expect(tela.textContent).toContain('Encerrada por arquivamento da base antiga')
  expect(tela.textContent).toContain('Histórico de coletas do Google')
})
test('gestor distingue venda e contato sem anotação sem perder autoria anterior', async () => {
  mocks.historico.mockResolvedValue({ ok: true, contatos: [{ ...contato, nota: null, autor: 'Autora anterior' }, {
    ...contato, id: 'v', tipo: 'venda_registrada', natureza: 'venda', nota: null,
    proximoPasso: null, proximoPassoData: null, venda: { centavos: '125050', data: '2026-11-04' },
  }] })
  const tela = await renderizar()
  const registros = [...tela.querySelectorAll('details')]
  expect(registros).toHaveLength(2)
  expect(registros[0].querySelector('summary')?.textContent).toContain('Autora anterior')
  expect(registros[0].textContent).toContain('Sem anotação.')
  expect(registros[0].querySelector('summary')?.textContent).not.toContain('Venda')
  expect(registros[1].querySelector('summary')?.textContent).toContain('Venda registrada')
  expect(registros[1].textContent).toContain('1.250,50')
})
