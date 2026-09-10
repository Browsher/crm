import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

// useActionState devolve [estado, ação, pendente]. Cada teste fixa o estado
// que quer renderizar: é o que permite exercitar os três ramos por
// renderToStaticMarkup, sem jsdom e sem clicar em nada. Foi o bug do estado
// inicial de /empresas/importar que estabeleceu este padrão.
const estado = vi.hoisted(() => ({ atual: { erro: null as string | null, filaVazia: false } }))
vi.mock('react', async () => {
  const react = await vi.importActual<typeof import('react')>('react')
  return { ...react, useActionState: () => [estado.atual, () => {}, false] }
})
vi.mock('./acoes', () => ({ agirNaFilaAcao: () => {} }))

const { Formulario } = await import('./formulario')

describe('Formulario', () => {
  test('sem reserva, oferece puxar e nao fala de fila vazia', () => {
    estado.atual = { erro: null, filaVazia: false }
    const saida = renderToStaticMarkup(<Formulario reserva={null} contatos={[]} />)
    expect(saida).toContain('Puxar próxima')
    expect(saida).not.toContain('trabalhadas nos últimos 30 dias')
  })

  test('fila vazia diz POR QUE, e nao usa a palavra quarentena', () => {
    estado.atual = { erro: null, filaVazia: true }
    const saida = renderToStaticMarkup(<Formulario reserva={null} contatos={[]} />)
    expect(saida).toContain('estão com alguém')
    expect(saida).toContain('últimos 30 dias')
    expect(saida.toLowerCase()).not.toContain('quarentena')
  })

  test('erro aparece na tela', () => {
    estado.atual = { erro: 'O tempo da reserva acabou.', filaVazia: false }
    const saida = renderToStaticMarkup(<Formulario reserva={null} contatos={[]} />)
    expect(saida).toContain('O tempo da reserva acabou.')
  })
})
