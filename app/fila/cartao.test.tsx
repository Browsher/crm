import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

// O Cartao passou a montar o FormularioContato, que é componente cliente e usa
// useActionState. Mesmo mock dos outros testes de render deste projeto: o que
// se prova é qual ramo renderiza, não que o estado chegue.
vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: () => [{ erro: null, ok: false }, () => {}, false] }
})
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
    const saida = renderToStaticMarkup(<Cartao empresa={BASE} agora={AGORA} contatos={[]} />)
    expect(saida).toContain('Aurora Comercio LTDA')
    expect(saida).toContain('Dona Aurora')
    expect(saida).toContain('11987654321')
    expect(saida).toContain('São Paulo')
  })

  test('conta os minutos que faltam a partir do instante do banco', () => {
    const saida = renderToStaticMarkup(<Cartao empresa={BASE} agora={AGORA} contatos={[]} />)
    expect(saida).toContain('18 minutos')
  })

  test('CEP fora da base diz que o endereco nao foi encontrado, e nao finge que nao ha CEP', () => {
    const saida = renderToStaticMarkup(<Cartao empresa={{ ...BASE, endereco: null }} agora={AGORA} contatos={[]} />)
    expect(saida).toContain('01310100')
    expect(saida).toContain('não encontrado')
  })

  test('empresa sem CEP diz que nao ha endereco', () => {
    const saida = renderToStaticMarkup(<Cartao empresa={{ ...BASE, cep: null, endereco: null }} agora={AGORA} contatos={[]} />)
    expect(saida).toContain('sem CEP')
  })

  // Os botões soltos de assumir e devolver saíram do cartão na fatia `contato`:
  // desfecho virou campo do formulário, e é ele que chama contato_registrar.
  test('em posse, nao mostra prazo, e o formulario pede proximo passo', () => {
    const saida = renderToStaticMarkup(
      <Cartao empresa={{ ...BASE, posse: true, reservadoAte: null }} agora={AGORA} contatos={[]} />,
    )
    expect(saida).not.toContain('minutos')
    expect(saida).toContain('Próximo passo')
  })

  test('o cartao mostra o historico de quem ligou antes', () => {
    const saida = renderToStaticMarkup(
      <Cartao
        empresa={BASE}
        agora={AGORA}
        contatos={[
          {
            id: '22222222-2222-4222-8222-222222222222',
            tipo: 'sem_interesse',
            nota: 'ja tem fornecedor',
            proximoPasso: null,
            proximoPassoData: null,
            criadoEm: new Date('2026-08-01T12:00:00Z'),
            autor: 'VendedorA',
          },
        ]}
      />,
    )
    expect(saida).toContain('ja tem fornecedor')
    expect(saida).toContain('VendedorA')
  })

  test('cartao sem historico diz que ninguem ligou ainda', () => {
    const saida = renderToStaticMarkup(<Cartao empresa={BASE} agora={AGORA} contatos={[]} />)
    expect(saida).toContain('Nenhum contato registrado')
  })

  test('o cartao NAO tem mais botoes soltos de assumir e devolver', () => {
    const saida = renderToStaticMarkup(<Cartao empresa={BASE} agora={AGORA} contatos={[]} />)
    expect(saida).not.toContain('value="assumir"')
    expect(saida).not.toContain('name="acao"')
  })
})
