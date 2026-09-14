import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const { Formulario } = await import('./formulario')

test('expõe busca e selects acessíveis com dependências desabilitadas', () => {
  const html = renderToStaticMarkup(<Formulario consulta={{
    termo: 'luz', padrao: 'luz', cnpjPrefixo: null, pagina: 2,
    cnae: null, uf: null, cidade: null, bairro: null,
  }} opcoes={[]} />)
  expect(html).toContain('for="empresas-busca"')
  expect(html).toContain('>Buscar empresas<')
  expect(html).toContain('for="empresas-cnae"')
  expect(html).toContain('for="empresas-uf"')
  expect(html).toContain('for="empresas-cidade"')
  expect(html).toContain('for="empresas-bairro"')
  expect(html).toContain('name="cidade" disabled=""')
  expect(html).toContain('name="bairro" disabled=""')
  expect(html).not.toContain('name="pagina"')
  expect(html).toContain('>Buscar</button>')
  expect(html).toContain('>Limpar filtros</a>')
})
