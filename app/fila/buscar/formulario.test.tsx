import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { FormularioBusca } from './formulario'
vi.mock('./acoes', () => ({ buscarEmpresasAcao: vi.fn() }))
test('formulário autorizado nasce utilizável com chave emitida pelo servidor e respeita a quota restante', () => {
  const html = renderToStaticMarkup(<FormularioBusca bloqueado={false} restante={3} chaveInicial="11111111-1111-4111-8111-111111111111" />)
  expect(html).not.toContain('disabled=""')
  expect(html).toContain('value="11111111-1111-4111-8111-111111111111"')
  const quantidade = html.match(/<input[^>]*name="quantidade"[^>]*>/)![0]
  expect(quantidade).toContain('max="3"')
  expect(quantidade).toContain('value="3"')
})
test('sem liberação do gestor o conjunto de filtros fica desabilitado', () => {
  const html = renderToStaticMarkup(<FormularioBusca bloqueado restante={0} chaveInicial="11111111-1111-4111-8111-111111111111" />)
  expect(html).toMatch(/<fieldset[^>]*disabled=""/)
})
