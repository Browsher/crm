import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import { ListaCarteira } from './lista'

const UMA: EmpresaComigo = {
  id: '11111111-1111-4111-8111-111111111111',
  cnpj: '11222333000181',
  razaoSocial: 'Aurora Comercio LTDA',
  nomeFantasia: null,
  contatoNome: null,
  telefone: '11987654321',
  email: null,
  cep: null,
  endereco: null,
  reservadoAte: null,
  posse: true,
  proximoPasso: null,
  proximoPassoData: null,
  vencido: false,
}

describe('ListaCarteira', () => {
  test('com empresas, monta uma lista', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[UMA]} />)
    expect(saida).toContain('<ul')
    expect(saida).toContain('Aurora Comercio LTDA')
  })

  test('vazia, diz o que fazer em vez de so dizer que esta vazia', () => {
    const saida = renderToStaticMarkup(<ListaCarteira linhas={[]} />)
    expect(saida).not.toContain('<ul')
    expect(saida).toContain('Puxar')
  })
})
