import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ perfil: vi.fn(), registrar: vi.fn(), revalidar: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'identidade-da-sessao' }) }))
vi.mock('@/src/features/prospeccao/recentes', () => ({ lerPerfil: mocks.perfil, registrarRecente: mocks.registrar }))
vi.mock('@/src/features/fila/consulta', () => ({ lerMinhasEmpresas: async () => ({ ok: true, contexto: null, reserva: null }) }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404') }, useRouter: () => ({ push: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidar }))
vi.mock('../acoes', () => ({ agirNaFilaAcao: vi.fn() }))

const id = '00000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.perfil.mockResolvedValue({ ok: true, empresa: { id, razaoSocial: 'Perfil empresa', nomeFantasia: null, cnaePrincipal: null, cidade: null, uf: null, bairro: null, disponibilidade: 'outro_vendedor' } })
  mocks.registrar.mockResolvedValue({ ok: true, registrado: true })
})
test('perfil mostra resumo e retorno filtrado sem gravar durante render', async () => {
  const { default: Pagina } = await import('./[id]/page')
  const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ nome: 'Luz', pagina: '2' }) }))
  expect(html).toContain('Perfil empresa')
  expect(html).toContain('Voltar para localizar')
  expect(html).toContain('/fila/localizar?nome=Luz&amp;pagina=2')
  expect(html).not.toContain('Reservar para ligar')
  expect(mocks.registrar).not.toHaveBeenCalled()
  expect(html).toContain('Consultar')
})

test('perfil disponível oferece reserva sem exibir dados privados', async () => {
  mocks.perfil.mockResolvedValue({ ok: true, empresa: { id, razaoSocial: 'Perfil empresa', nomeFantasia: null, cnaePrincipal: null, cidade: null, uf: null, bairro: null, disponibilidade: 'disponivel', telefone: '11999999999', email: 'sigilo@teste.local' } })
  const { default: Pagina } = await import('./[id]/page')
  const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }))
  expect(html).toContain('Reservar para ligar')
  expect(html).not.toContain('11999999999')
  expect(html).not.toContain('sigilo@teste.local')
})
test('perfil inválido ou inexistente responde 404', async () => {
  const { default: Pagina } = await import('./[id]/page')
  await expect(Pagina({ params: Promise.resolve({ id: 'invalido' }), searchParams: Promise.resolve({}) })).rejects.toThrow('404')
  mocks.perfil.mockResolvedValue({ ok: true, empresa: null })
  await expect(Pagina({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })).rejects.toThrow('404')
})
test('ação valida UUID, usa sessão e revalida lista somente no sucesso', async () => {
  const { registrarVisitaAcao } = await import('./registrar-visita-acao')
  expect((await registrarVisitaAcao('invalido')).erro).toBeTruthy()
  expect(mocks.registrar).not.toHaveBeenCalled()
  expect(await registrarVisitaAcao(id)).toEqual({ erro: null })
  expect(mocks.registrar).toHaveBeenCalledWith('identidade-da-sessao', id)
  expect(mocks.revalidar).toHaveBeenCalledWith('/fila/localizar')
  mocks.revalidar.mockClear()
  mocks.registrar.mockResolvedValue({ ok: false, motivo: 'sem_permissao' })
  expect((await registrarVisitaAcao(id)).erro).toBeTruthy()
  expect(mocks.revalidar).not.toHaveBeenCalled()
})
