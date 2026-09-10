import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import { Cartao } from './cartao'

const AGORA = new Date('2026-09-10T12:00:00Z')

const BASE: EmpresaComigo = {
  id: '11111111-1111-4111-8111-111111111111',
  cnpj: '11222333000181',
  razaoSocial: 'Aurora Comercio LTDA',
  nomeFantasia: 'Aurora Luz',
  contatoNome: 'Dona Aurora',
  telefone: '11987654321',
  email: null,
  cep: '01310100',
  endereco: {
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    faixa: 'lado par',
    bairro: 'Bela Vista',
    localidade: 'São Paulo',
    uf: 'SP',
    ibge: '3550308',
  },
  reservadoAte: new Date('2026-09-10T12:18:00Z'),
  posse: false,
  proximoPasso: null,
  proximoPassoData: null,
  vencido: false,
}

describe('Cartao', () => {
  test('mostra contato, telefone e cidade', () => {
    const saida = renderToStaticMarkup(<Cartao empresa={BASE} agora={AGORA} />)
    expect(saida).toContain('Aurora Comercio LTDA')
    expect(saida).toContain('Dona Aurora')
    expect(saida).toContain('11987654321')
    expect(saida).toContain('São Paulo')
  })

  test('conta os minutos que faltam a partir do instante do banco', () => {
    const saida = renderToStaticMarkup(<Cartao empresa={BASE} agora={AGORA} />)
    expect(saida).toContain('18 minutos')
  })

  test('CEP fora da base diz que o endereco nao foi encontrado, e nao finge que nao ha CEP', () => {
    const saida = renderToStaticMarkup(<Cartao empresa={{ ...BASE, endereco: null }} agora={AGORA} />)
    expect(saida).toContain('01310100')
    expect(saida).toContain('não encontrado')
  })

  test('empresa sem CEP diz que nao ha endereco', () => {
    const saida = renderToStaticMarkup(<Cartao empresa={{ ...BASE, cep: null, endereco: null }} agora={AGORA} />)
    expect(saida).toContain('sem CEP')
  })

  test('em posse, nao mostra prazo nem botao de assumir', () => {
    const saida = renderToStaticMarkup(
      <Cartao empresa={{ ...BASE, posse: true, reservadoAte: null }} agora={AGORA} />,
    )
    expect(saida).not.toContain('minutos')
    expect(saida).not.toContain('Assumir')
    expect(saida).toContain('Devolver')
  })
})
