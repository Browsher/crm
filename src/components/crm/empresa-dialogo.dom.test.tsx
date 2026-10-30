// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
const m = vi.hoisted(() => ({ ler: vi.fn() }))
vi.mock('@/app/empresas/busca/detalhe-acao', () => ({ lerDetalhesEmpresaAcao: m.ler }))
import { EmpresaDialogo } from './empresa-dialogo'
import type { DetalhesEmpresa, ReferenciaEmpresa } from '@/src/lib/empresa-visual'
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); vi.clearAllMocks() })
function dados(nome: string): DetalhesEmpresa { return { nome, referencia: { tipo: 'cadastro', empresaId: nome }, id: nome, cnpj: null, cnae: null, atividade: null, bairro: null, cidade: null, uf: null, origens: ['google'], recebidaEm: null, situacao: 'a_contatar', versao: 1, negociacaoId: null, telefone: null, email: null, razaoSocial: nome, nomeFantasia: null, logradouro: null, numero: null, complemento: null, cep: null, porte: null, situacaoCadastral: null, dataAbertura: null, telefones: [], dadosCadastrais: null } }
test('seleção B oculta A imediatamente e resposta atrasada A não substitui B; conteúdo só informativo', async () => {
  let concluir!: (r: { ok: true; dados: DetalhesEmpresa }) => void
  m.ler.mockImplementationOnce(() => new Promise(r => { concluir = r })).mockResolvedValueOnce({ ok: true, dados: dados('Empresa B') })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  const fechar = vi.fn()
  const ref = (id: string): ReferenciaEmpresa => ({ tipo: 'cadastro', empresaId: id })
  await act(async () => root.render(<EmpresaDialogo referencia={ref('A')} aoFechar={fechar} />))
  await act(async () => root.render(<EmpresaDialogo referencia={ref('B')} aoFechar={fechar} />))
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Empresa B')
  await act(async () => concluir({ ok: true, dados: dados('Empresa A') }))
  const texto = document.querySelector('[role="dialog"]')!.textContent
  expect(texto).not.toContain('Empresa A')
  expect(texto).not.toContain('Prospectar esta lista')
  expect(texto).not.toContain('Filtros usados')
  expect(document.querySelector('[role="dialog"] a')).toBeNull()
  expect(document.activeElement?.textContent).toBe('Ver empresa')
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Fechar"]')!.click())
  expect(fechar).toHaveBeenCalledOnce()
})
test('falha não deixa dados antigos e retorno de foco preserva botão que abriu', async () => {
  m.ler.mockResolvedValueOnce({ ok: true, dados: dados('Empresa A') }).mockRejectedValueOnce(new Error('rede'))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  const abrir = document.createElement('button'); document.body.append(abrir); abrir.focus()
  const fechar = vi.fn()
  await act(async () => root.render(<EmpresaDialogo referencia={{ tipo: 'cadastro', empresaId: 'A' }} aoFechar={fechar} />))
  await act(async () => root.render(<EmpresaDialogo referencia={{ tipo: 'cadastro', empresaId: 'B' }} aoFechar={fechar} />))
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Empresa A')
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível carregar')
  await act(async () => root.unmount())
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
  expect(document.activeElement).toBe(abrir)
  abrir.remove()
  root = undefined as unknown as ReturnType<typeof createRoot>
})
test('indisponibilidade salva distingue pendência e origem inativa sem ação comercial', async () => {
  m.ler.mockResolvedValueOnce({ok:true,dados:{...dados('Pendente'),motivoIndisponibilidade:'pendente'}}).mockResolvedValueOnce({ok:true,dados:{...dados('Inativa'),motivoIndisponibilidade:'origem_inativa'}})
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  await act(async()=>root.render(<EmpresaDialogo referencia={{tipo:'cadastro',empresaId:'pendente'}} aoFechar={()=>{}} />))
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Vínculo pendente de revisão')
  await act(async()=>root.render(<EmpresaDialogo referencia={{tipo:'cadastro',empresaId:'inativa'}} aoFechar={()=>{}} />))
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Origem inativa')
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Iniciar atendimento')
})
