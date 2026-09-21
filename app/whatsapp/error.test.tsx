import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import ErroWhatsApp from './error'

test('falha da Evolution exibe retomada sem revelar mensagem interna ou chave', () => {
  const html = renderToStaticMarkup(<ErroWhatsApp error={new Error('apikey segredo-sintetico')} reset={() => {}} />)
  expect(html).toContain('Não foi possível carregar as mensagens')
  expect(html).toContain('type="button"')
  expect(html).toContain('Tentar novamente')
  expect(html).not.toContain('segredo-sintetico')
})
