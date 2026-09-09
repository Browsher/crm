import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { Paginacao } from './paginacao'

describe('Paginacao', () => {
  test('uma página só: não aparece', () => {
    expect(renderToStaticMarkup(<Paginacao pagina={1} paginas={1} termo="" />)).toBe('')
  })

  test('na primeira, "Anterior" não é link', () => {
    const saida = renderToStaticMarkup(<Paginacao pagina={1} paginas={3} termo="" />)
    expect(saida).toContain('href="/empresas?pagina=2"')
    expect(saida).not.toContain('pagina=0')
  })

  test('no meio, os dois lados são link', () => {
    const saida = renderToStaticMarkup(<Paginacao pagina={2} paginas={3} termo="" />)
    expect(saida).toContain('href="/empresas?pagina=1"')
    expect(saida).toContain('href="/empresas?pagina=3"')
  })

  test('na última, "Próxima" não é link', () => {
    expect(renderToStaticMarkup(<Paginacao pagina={3} paginas={3} termo="" />)).not.toContain('pagina=4')
  })

  test('diz onde a pessoa está', () => {
    expect(renderToStaticMarkup(<Paginacao pagina={2} paginas={3} termo="" />)).toContain('2 de 3')
  })

  // Perder o termo ao virar a página é o defeito clássico de paginação com
  // busca: a página 2 traz outra coisa.
  test('o termo viaja com a página, codificado', () => {
    const saida = renderToStaticMarkup(<Paginacao pagina={1} paginas={3} termo="são joão" />)
    expect(saida).toContain('q=s%C3%A3o+jo%C3%A3o')
    expect(saida).toContain('pagina=2')
  })
})
