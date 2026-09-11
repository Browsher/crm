import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { EmpresaComigo } from '@/src/features/fila/consulta'

// A Ficha monta o FormularioContato, que é cliente e usa useActionState.
vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: () => [{ erro: null, ok: false }, () => {}, false] }
})

const { Ficha } = await import('./ficha')

const EMPRESA: EmpresaComigo = {
  id: 'a',
  cnpj: '11222333000181',
  razaoSocial: 'Aurora Comercio LTDA',
  nomeFantasia: 'Aurora Luz',
  contatoNome: 'Dona Aurora',
  telefone: '11987654321',
  email: null,
  cep: '01310100',
  endereco: null,
  reservadoAte: null,
  posse: true,
  proximoPasso: 'Mandar orçamento',
  proximoPassoData: '2026-10-01',
  cnaePrincipal: null,
  ultimoContato: null,
  situacaoRetorno: 'sem_data',
  vencido: false,
}

describe('Ficha', () => {
  test('mostra cadastro, telefone e CNPJ', () => {
    const saida = renderToStaticMarkup(<Ficha empresa={EMPRESA} contatos={[]} />)
    expect(saida).toContain('Aurora Comercio LTDA')
    expect(saida).toContain('11987654321')
    expect(saida).toContain('11222333000181')
  })

  test('mostra o proximo passo que vale hoje', () => {
    const saida = renderToStaticMarkup(<Ficha empresa={EMPRESA} contatos={[]} />)
    expect(saida).toContain('Mandar orçamento')
    expect(saida).toContain('2026-10-01')
  })

  test('vencido aparece com palavra', () => {
    const saida = renderToStaticMarkup(<Ficha empresa={{ ...EMPRESA, vencido: true }} contatos={[]} />)
    expect(saida).toContain('vencido')
  })

  test('sem proximo passo, diz que nao ha combinado', () => {
    const saida = renderToStaticMarkup(
      <Ficha empresa={{ ...EMPRESA, proximoPasso: null, proximoPassoData: null }} contatos={[]} />,
    )
    expect(saida).toContain('Sem próximo passo combinado')
  })

  // O gap da fila.1 que esta fatia fecha: hoje não existe caminho de tela para
  // devolver empresa da carteira. Quem assume por engano fica com ela.
  test('tem o caminho de devolver, que a carteira nao tinha', () => {
    const saida = renderToStaticMarkup(<Ficha empresa={EMPRESA} contatos={[]} />)
    expect(saida).toContain('value="devolver"')
  })

  test('com posse, o formulario pede proximo passo', () => {
    const saida = renderToStaticMarkup(<Ficha empresa={EMPRESA} contatos={[]} />)
    expect(saida).toContain('Próximo passo')
  })

  test('a linha do tempo vazia diz que ninguem ligou ainda', () => {
    const saida = renderToStaticMarkup(<Ficha empresa={EMPRESA} contatos={[]} />)
    expect(saida).toContain('Nenhum contato registrado')
  })
})
