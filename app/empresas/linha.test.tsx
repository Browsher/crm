import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'
import { Linha } from './linha'

const BASE: EmpresaNaLista = {
  id: '11111111-1111-4111-8111-111111111111',
  cnpj: '11222333000181',
  razaoSocial: 'Iluminação São João',
  nomeFantasia: 'LÂMPADAS Ltda',
  telefone: '11987654321',
  email: 'contato@exemplo.com',
  cep: '01310100',
  cnaePrincipal: null,
  localidade: 'São Paulo',
  uf: 'SP',
}

const html = (e: Partial<EmpresaNaLista> = {}) => renderToStaticMarkup(<Linha empresa={{ ...BASE, ...e }} />)

describe('Linha: o que sempre aparece', () => {
  test('mostra o código do CNAE principal informado', () => {
    expect(html({ cnaePrincipal: '4742300' })).toContain('CNAE: 4742300')
  })

  test('explicita quando o CNAE principal não foi informado', () => {
    expect(html()).toContain('CNAE: Não informado')
  })

  test('CNPJ e telefone formatados, não como estão no banco', () => {
    expect(html()).toContain('11.222.333/0001-81')
    expect(html()).toContain('(11) 98765-4321')
    expect(html()).not.toContain('11222333000181')
  })

  test('razão social e nome fantasia', () => {
    expect(html()).toContain('Iluminação São João')
    expect(html()).toContain('LÂMPADAS Ltda')
  })

  test('sem nome fantasia, não sobra rótulo vazio', () => {
    expect(html({ nomeFantasia: null })).not.toContain('LÂMPADAS')
  })

  test('sem e-mail, não sobra rótulo vazio', () => {
    expect(html({ email: null })).not.toContain('contato@exemplo.com')
  })
})

// Três estados, três frases diferentes. "sem endereço" para os dois últimos
// juntos esconderia a diferença entre "ninguém preencheu" e "a base de
// julho/2024 não tem este CEP" — que são consertos diferentes.
describe('Linha: os três estados do endereço', () => {
  test('CEP resolvido mostra cidade e UF', () => {
    expect(html()).toContain('São Paulo/SP')
  })

  test('CEP que a base não resolveu mostra o CEP e diz isso', () => {
    const saida = html({ cep: '99999999', localidade: null, uf: null })
    expect(saida).toContain('99999999')
    expect(saida).toContain('não encontrado na base')
  })

  test('empresa sem CEP diz que não tem CEP', () => {
    const saida = html({ cep: null, localidade: null, uf: null })
    expect(saida).toContain('sem CEP')
    expect(saida).not.toContain('não encontrado na base')
  })
})
