import { beforeEach, expect, test, vi } from 'vitest'
const m = vi.hoisted(() => ({ exigir: vi.fn(), repo: vi.fn(), ler: vi.fn(), limite: vi.fn(), detalhes: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: m.exigir }))
vi.mock('@/src/features/busca-empresas/repositorio', () => ({ repositorioBusca: m.repo }))
vi.mock('@/src/server/empresas/detalhes', () => ({ lerDetalhesEmpresa: m.detalhes }))
import { lerDetalheBuscaAcao, lerEmpresaBuscaAcao, lerDetalhesEmpresaAcao } from './detalhe-acao'
import { EmpresaDetalhes } from '@/src/components/crm/empresa-detalhes'
import { renderToStaticMarkup } from 'react-dom/server'
import { isValidElement } from 'react'
import type { BuscaSalva } from '@/src/features/busca-empresas/tipos'

beforeEach(() => {
  vi.clearAllMocks()
  m.exigir.mockResolvedValue({ usuarioId: 'da-sessao', papel: 'vendedor' })
  m.repo.mockReturnValue({ ler: m.ler, meuLimite: m.limite })
  m.ler.mockResolvedValue({ id: 'busca', empresas: [] } as unknown as BuscaSalva)
  m.limite.mockResolvedValue({ pausado: true })
})
test('exige sessão válida antes de qualquer leitura', async () => {
  m.exigir.mockRejectedValue(new Error('sessão necessária'))
  await expect(lerDetalheBuscaAcao('busca')).rejects.toThrow('sessão necessária')
  expect(m.exigir).toHaveBeenCalledWith('usuario')
  expect(m.repo).not.toHaveBeenCalled()
})
test('usa identidade da sessão e leitura protegida por RLS, sem criar consulta', async () => {
  const r = await lerDetalheBuscaAcao('busca')
  expect(m.repo).toHaveBeenCalledWith('da-sessao')
  expect(m.ler).toHaveBeenCalledWith('busca')
  expect(r.ok).toBe(true)
  if (!r.ok || !isValidElement(r.conteudo)) throw new Error('conteúdo ausente')
  expect(r.conteudo.props).toMatchObject({ gestor: false, bloqueada: true })
})
test('ausência e falha não retornam dados de outra busca', async () => {
  m.ler.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('falha interna privada'))
  expect(await lerDetalheBuscaAcao('outra')).toMatchObject({ ok: false, erro: expect.stringContaining('não está disponível') })
  expect(await lerDetalheBuscaAcao('outra')).toEqual({ ok: false, erro: 'Não foi possível carregar a busca. Tente novamente.' })
  expect(m.limite).not.toHaveBeenCalled()
})
test('papel do gestor vem da sessão e dispensa limite de vendedor', async () => {
  m.exigir.mockResolvedValue({ usuarioId: 'gestor', papel: 'gestor' })
  const r = await lerDetalheBuscaAcao('busca')
  if (!r.ok || !isValidElement(r.conteudo)) throw new Error('conteúdo ausente')
  expect(r.conteudo.props).toMatchObject({ gestor: true, bloqueada: false })
  expect(m.limite).not.toHaveBeenCalled()
})

test('empresa recente usa identidade autenticada e só componente de dados, sem metadados/limite/fornecedor',async()=>{
 const dados={nome:'Empresa B',cnpj:'99887766000105',telefones:[],dadosCadastrais:null}
 m.detalhes.mockResolvedValue({ok:true,dados})
 const r=await lerEmpresaBuscaAcao('busca',dados.cnpj)
 expect(m.exigir).toHaveBeenCalledWith('usuario')
 expect(m.detalhes).toHaveBeenCalledWith('da-sessao',{tipo:'busca',buscaId:'busca',cnpj:dados.cnpj})
 if(!r.ok||!isValidElement(r.conteudo))throw new Error('conteúdo ausente')
 expect(r.conteudo.type).toBe(EmpresaDetalhes)
 expect(r.conteudo.props).toEqual({empresa:dados})
 const conteudo=renderToStaticMarkup(r.conteudo)
 expect(conteudo).not.toContain('Prospectar esta lista')
 expect(conteudo).not.toContain('Filtros usados')
 expect(m.repo).not.toHaveBeenCalled()
 expect(m.limite).not.toHaveBeenCalled()
 m.detalhes.mockResolvedValue({ok:false,motivo:'sem_permissao'})
 expect(await lerEmpresaBuscaAcao('outra',dados.cnpj)).toMatchObject({ok:false})
})

test('action comum autentica antes de carregar DTO e não aceita identidade/papel da tela',async()=>{
 m.exigir.mockRejectedValueOnce(new Error('sem sessão'))
 await expect(lerDetalhesEmpresaAcao({tipo:'cadastro',empresaId:'id'})).rejects.toThrow('sem sessão')
 expect(m.detalhes).not.toHaveBeenCalled()
 m.exigir.mockResolvedValue({usuarioId:'gestor-da-sessao',papel:'gestor'})
 m.detalhes.mockResolvedValue({ok:false,motivo:'sem_permissao'})
 await lerDetalhesEmpresaAcao({tipo:'cadastro',empresaId:'id'})
 expect(m.detalhes).toHaveBeenCalledWith('gestor-da-sessao',{tipo:'cadastro',empresaId:'id'})
})

test('adapter de empresa preserva a guarda antes de tratar falhas de leitura',async()=>{
 m.exigir.mockRejectedValue(new Error('sessão necessária'))
 await expect(lerEmpresaBuscaAcao('busca','99887766000105')).rejects.toThrow('sessão necessária')
 expect(m.detalhes).not.toHaveBeenCalled()
})
