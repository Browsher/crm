import { beforeEach, expect, test, vi } from 'vitest'
import { urlFichaGestor } from '@/src/lib/retorno-gestor'
import { lerFichaEmpresaAcao } from './ficha-acao'

const mocks = vi.hoisted(() => ({ exigir: vi.fn(), perfil: vi.fn(), historico: vi.fn(), cadastrais: vi.fn(), coletas: vi.fn(), socios: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: mocks.exigir }))
vi.mock('@/src/features/empresas/perfil', () => ({ lerPerfilEmpresa: mocks.perfil }))
vi.mock('@/src/features/contato/historico', () => ({ lerHistorico: mocks.historico }))
vi.mock('@/src/server/cnpj-biz/dados', () => ({ lerDadosCadastrais: mocks.cadastrais }))
vi.mock('@/src/features/google/repositorio', () => ({ repositorioGoogle: () => ({ historicoEmpresa: mocks.coletas }) }))
vi.mock('../socios-gestor', () => ({ lerSociosGestor: mocks.socios }))

const id = '11111111-1111-4111-8111-111111111111'
const pedidoId = '22222222-2222-4222-8222-222222222222'
const origem = { tipo: 'empresas', q: 'Aurora', pagina: 2, uf: 'SP' } as const

beforeEach(() => {
  vi.resetAllMocks()
  mocks.exigir.mockResolvedValue({ usuarioId: 'gestor-da-sessao' })
  mocks.perfil.mockResolvedValue({ id, nome: 'Aurora', razaoSocial: 'Aurora', nomeFantasia: 'Aurora Luz', situacao: 'a_contatar', grupos: [], resumo: { origem: 'banco' } })
  mocks.historico.mockResolvedValue({ ok: true, contatos: [{ criadoEm: new Date('2026-11-10T15:00:00Z') }] })
  mocks.cadastrais.mockResolvedValue({ detalhes: { socios: [{ nome: 'Sócio cadastral', cnpj_cpf_socio: 'privado', funcao: { descricao: 'Administrador', codigo: '1' } }] } })
  mocks.coletas.mockResolvedValue([{ pedidoId, dia: '2026-11-10', vendedor: 'Ana', nicho: 'Iluminação', situacao: 'entregue' }])
  mocks.socios.mockResolvedValue([{ cnpj: '11222333000181', dados: ['Sócio autorizado'] }])
})

test.each(['sessão ausente', 'vendedor'])('exige gestor antes de consultar dados com %s', async motivo => {
  mocks.exigir.mockRejectedValue(new Error(motivo))
  await expect(lerFichaEmpresaAcao(urlFichaGestor(id))).rejects.toThrow(motivo)
  expect(mocks.exigir).toHaveBeenCalledWith('gestor')
  for (const leitor of [mocks.perfil, mocks.historico, mocks.cadastrais, mocks.coletas, mocks.socios]) expect(leitor).not.toHaveBeenCalled()
})

test('lê a ficha autorizada e devolve apenas os dados usados com o mesmo retorno da rota canônica', async () => {
  const r = await lerFichaEmpresaAcao(urlFichaGestor(id, origem, 'historico'))
  expect(mocks.perfil).toHaveBeenCalledWith('gestor-da-sessao', id)
  expect(mocks.historico).toHaveBeenCalledWith('gestor-da-sessao', id)
  expect(mocks.cadastrais).toHaveBeenCalledWith('gestor-da-sessao', id)
  expect(mocks.coletas).toHaveBeenCalledWith(id)
  expect(mocks.socios).toHaveBeenCalledWith('gestor-da-sessao', { empresaId: id })
  if (!r.ok) throw new Error('Ficha indisponível')
  expect(r).toMatchObject({ abaInicial: 'historico', origemHistorico: origem, ficha: {
    empresa: { nome: 'Aurora', nomeFantasia: 'Aurora Luz' },
    historico: { ok: true, contatos: [{ criadoEm: new Date('2026-11-10T15:00:00Z') }] },
    socios: [{ cnpj: '11222333000181', dados: ['Sócio autorizado'] }],
    coletas: [{ pedidoId }],
  } })
  expect(r.ficha.empresa).not.toHaveProperty('resumo')
  expect(r.ficha.cadastrais?.detalhes?.socios).toEqual([{ nome: 'Sócio cadastral', funcao: { descricao: 'Administrador' } }])
})

test('sinaliza ausência, recusa endereços de fora da ficha e oculta detalhes de falhas recuperáveis', async () => {
  await expect(lerFichaEmpresaAcao('https://fora.exemplo/empresas/' + id)).resolves.toEqual({ ok: false, motivo: 'nao_encontrada' })
  expect(mocks.perfil).not.toHaveBeenCalled()
  mocks.perfil.mockResolvedValueOnce(null)
  await expect(lerFichaEmpresaAcao(urlFichaGestor(id))).resolves.toEqual({ ok: false, motivo: 'nao_encontrada' })
  expect(mocks.historico).not.toHaveBeenCalled()
  mocks.socios.mockRejectedValueOnce(new Error('detalhe privado de infraestrutura'))
  await expect(lerFichaEmpresaAcao(urlFichaGestor(id))).resolves.toEqual({ ok: false, motivo: 'falha_leitura' })
})
