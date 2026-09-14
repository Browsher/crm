import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { Paginacao } from './paginacao'

const consulta = {
  termo: '',
  padrao: '',
  cnpjPrefixo: null,
  pagina: 1,
  cnae: null,
  uf: null,
  cidade: null,
  bairro: null,
}

describe('Paginacao', () => {
  test('uma página só: não aparece', () => {
    expect(renderToStaticMarkup(<Paginacao consulta={consulta} paginas={1} />)).toBe('')
  })

  test('na primeira, "Anterior" não é link', () => {
    const saida = renderToStaticMarkup(<Paginacao consulta={consulta} paginas={3} />)
    expect(saida).toContain('href="/empresas?pagina=2"')
    expect(saida).not.toContain('pagina=0')
  })

  test('no meio, os dois lados são link', () => {
    const saida = renderToStaticMarkup(<Paginacao consulta={{ ...consulta, pagina: 2 }} paginas={3} />)
    expect(saida).toContain('href="/empresas?pagina=1"')
    expect(saida).toContain('href="/empresas?pagina=3"')
  })

  test('na última, "Próxima" não é link', () => {
    expect(renderToStaticMarkup(<Paginacao consulta={{ ...consulta, pagina: 3 }} paginas={3} />)).not.toContain('pagina=4')
  })

  test('diz onde a pessoa está', () => {
    expect(renderToStaticMarkup(<Paginacao consulta={{ ...consulta, pagina: 2 }} paginas={3} />)).toContain('2 de 3')
  })

  // Perder o termo ao virar a página é o defeito clássico de paginação com
  // busca: a página 2 traz outra coisa.
  test('o termo viaja com a página, codificado', () => {
    const saida = renderToStaticMarkup(<Paginacao consulta={{ ...consulta, termo: 'são joão' }} paginas={3} />)
    expect(saida).toContain('q=s%C3%A3o+jo%C3%A3o')
    expect(saida).toContain('pagina=2')
  })


  test('os quatro selects viajam com a página, codificados', () => {
    const saida = renderToStaticMarkup(<Paginacao consulta={{
      ...consulta,
      termo: 'luz',
      cnae: '4742300',
      uf: 'SP',
      cidade: '3550308',
      bairro: 'Mooca & Brás',
    }} paginas={3} />)
    expect(saida).toContain('q=luz')
    expect(saida).toContain('cnae=4742300')
    expect(saida).toContain('uf=SP')
    expect(saida).toContain('cidade=3550308')
    expect(saida).toContain('bairro=Mooca+%26+Br%C3%A1s')
    expect(saida).toContain('pagina=2')
  })
})
