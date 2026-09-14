import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Loading from './loading'
import Erro from './error'

test('carregamento anuncia espera sem mostrar zeros', () => {
  const html = renderToStaticMarkup(<Loading />)
  expect(html).toContain('role="status"')
  expect(html).toContain('Carregando')
})
test('falha oferece recuperação sem expor detalhes internos', () => {
  const html = renderToStaticMarkup(<Erro />)
  expect(html).toContain('role="alert"')
  expect(html).toContain('Não foi possível carregar')
  expect(html).toContain('href="/gestao"')
})
