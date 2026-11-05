// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import Pagina from './page'
const mocks = vi.hoisted(() => ({ ler: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'gestor' }) }))
vi.mock('@/src/features/gestao/perfil-vendedor', async importOriginal => ({
  ...await importOriginal<typeof import('@/src/features/gestao/perfil-vendedor')>(), lerPerfilVendedor: mocks.ler,
}))
const nota = 'Nota completa da atividade.\n'.repeat(50)
test('perfil mantém as 20 atividades autorizadas com empresa recolhida, autoria e retorno históricos sem inventar vendas', async () => {
  mocks.ler.mockResolvedValue({ id: 'v', nome: 'Ana selecionada', email: 'ana@teste.local', pagina: 1,
    clientes: 0, oportunidades: 0, totalEmpresas: 0, atrasados: 0, hoje: 0, contatosHoje: 0, empresas: [],
    atividade: Array.from({ length: 20 }, (_, i) => ({ id: 'c' + i, empresaId: 'e' + i, empresa: 'Empresa ' + i,
      tipo: i === 0 ? 'nao_liguei' : i === 1 ? 'tipo legado' : 'acompanhamento',
      natureza: i === 0 ? 'atividade_sem_ligacao' : 'contato', nota: i === 1 ? null : nota,
      proximoPasso: i === 0 ? 'Retorno histórico' : null, retorno: i === 0 ? '2026-10-01' : null, em: '2026-11-05T01:30:00Z' })),
  })
  const tela = document.createElement('div')
  tela.innerHTML = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ id: 'v' }) }))
  const historico = tela.querySelector('[aria-label="Histórico comercial"]')!
  expect(historico).not.toBeNull()
  const registros = [...historico.querySelectorAll('details')]
  expect(registros).toHaveLength(20)
  for (const [i, registro] of registros.entries()) {
    expect(registro.open).toBe(false)
    expect(registro.querySelector('summary')?.textContent).toContain('Empresa ' + i)
    expect(registro.querySelector('summary')?.textContent).toContain('Ana selecionada')
  }
  expect(registros[0].querySelector('summary')?.textContent).toContain('Atividade sem ligação')
  expect(registros[0].querySelector('summary')?.textContent).toContain('04/11/2026')
  expect(registros[0].querySelector('summary')?.textContent).toContain('22:30')
  expect(registros[0].textContent).toContain(nota)
  expect(registros[0].querySelector('time[datetime="2026-10-01"]')?.textContent).toBe('01/10/2026')
  expect(registros[1].textContent).toContain('Sem anotação.')
  expect(registros[1].querySelector('summary')?.textContent).toContain('tipo legado')
  expect(historico.textContent).not.toContain('Venda registrada')
  expect(historico.textContent).not.toContain('Data da venda')
  expect(historico.textContent).not.toMatch(/atrasad/i)
})
