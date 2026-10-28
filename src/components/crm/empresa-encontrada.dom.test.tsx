// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { EmpresasBancoRecentes } from '@/app/fila/buscar/empresas-recentes'
import type { EmpresaBancoRecente } from '@/src/lib/empresas-banco-recentes'
import { lerEmpresaBuscaAcao } from '@/app/empresas/busca/detalhe-acao'
vi.mock('@/app/empresas/busca/detalhe-acao', () => ({ lerEmpresaBuscaAcao: vi.fn() }))
import { EmpresaEncontradaDetalhes } from './empresa-encontrada'
import type { EmpresaEncontrada } from '@/src/features/busca-empresas/tipos'

const empresa: EmpresaEncontrada = {
  cnpj: '98765432000198', razao_social: 'Empresa fictícia', nome_fantasia: 'Armarinhos fictícios',
  telefone: '11988887777', telefones: ['11988887777', '1133334444'], email: 'exemplo@empresa.test',
  cep: '01001000', cnae_principal: '4755502', situacao: 'ATIVA', porte: 'ME', data_abertura: '2020-01-15',
  logradouro: 'Rua fictícia', numero: '10', complemento: 'Sala 2', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP',
  detalhes: { capital_social: '1000.00', natureza_juridica: 'Sociedade limitada', regime_tributario: ['Simples Nacional'],
    atividades_secundarias: ['4781400'], socios: [{ nome: 'Pessoa fictícia', funcao: { descricao: 'Administrador' }, cnpj_cpf_socio: 'DOCUMENTO-PRIVADO', representante_legal: { nome: 'REPRESENTANTE-PRIVADO', cpf: 'CPF-PRIVADO' } }] },
}
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove() })

test('Ver mais expande cards organizados e mostra CEP, contatos e cadastro sem documentos privados', async () => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<EmpresaEncontradaDetalhes empresa={empresa} />))
  const botao = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Ver mais'))
  expect(botao).toBeDefined()
  expect(botao!.getAttribute('aria-expanded')).toBe('false')
  await act(async () => botao!.click())
  expect(botao!.getAttribute('aria-expanded')).toBe('true')
  const painel = document.getElementById(botao!.getAttribute('aria-controls')!)!
  for (const texto of ['Cadastro', 'Endereço', 'Contatos', 'Atividades e tributação', 'Sócios e administradores', 'Rua fictícia', 'Sala 2', 'Centro', 'Sociedade limitada', '01001-000', '(11) 3333-4444', '15/01/2020', 'Pessoa fictícia', 'Administrador']) expect(painel.textContent).toContain(texto)
  expect(painel.querySelectorAll('[data-slot="card"]').length).toBeGreaterThanOrEqual(4)
  for (const segredo of ['DOCUMENTO-PRIVADO', 'REPRESENTANTE-PRIVADO', 'CPF-PRIVADO']) expect(host.textContent).not.toContain(segredo)
  await act(async () => botao!.click())
  expect(botao!.getAttribute('aria-expanded')).toBe('false')
})


test('detalhes ignoram resposta atrasada de A depois de selecionar B', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  let concluirA!: (value: { ok: true; conteudo: React.ReactNode }) => void
  let concluirB!: (value: { ok: true; conteudo: React.ReactNode }) => void
  vi.mocked(lerEmpresaBuscaAcao).mockImplementationOnce(() => new Promise(resolve => { concluirA = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { concluirB = resolve }))
  const recente = (nome: string): EmpresaBancoRecente => ({
    id: nome, nome, buscaId: nome, cnpj: '12345678000100', empresaId: null, cnae: null,
    cep: null, porte: null, abertura: null, bairro: null, cidade: null, uf: null,
    origens: ['banco'], nichos: [], regioes: [], entrada: '2026-10-27T12:00:00Z',
    situacao: 'a_contatar', atividade: null, endereco: '', comTelefone: false, comEmail: false,
  })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  try {
    await act(async () => root.render(<EmpresasBancoRecentes empresas={[recente('Empresa A'), recente('Empresa B')]} />))
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Ver empresa: Empresa A"]')!.click())
    // Fecha A enquanto a action continua pendente e abre B.
    await act(async () => document.querySelector<HTMLButtonElement>('.ui-dialog-close')!.click())
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Ver empresa: Empresa B"]')!.click())
    await act(async () => concluirB({ ok: true, conteudo: <p>Detalhe correto B</p> }))
    await act(async () => concluirA({ ok: true, conteudo: <p>Detalhe antigo A</p> }))
    const dialogo = document.querySelector('[role="dialog"]')!
    expect(dialogo.textContent).toContain('Empresa B')
    expect(dialogo.textContent).toContain('Detalhe correto B')
    expect(dialogo.textContent).not.toContain('Detalhe antigo A')
  } finally { vi.unstubAllGlobals(); vi.mocked(lerEmpresaBuscaAcao).mockReset() }
})
