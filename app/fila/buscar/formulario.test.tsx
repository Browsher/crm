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

test('banco inicia com seis cartões e somente Atividade e nome aberto',()=>{
  const html=renderToStaticMarkup(<FormularioBusca bloqueado={false} restante={100} chaveInicial="11111111-1111-4111-8111-111111111111"/>)
  expect(html.match(/aria-expanded="true"/g)).toHaveLength(1)
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(5)
  for(const titulo of ['Atividade e nome','Localização','Perfil da empresa','Capital e data de abertura','Contatos e qualidade','Resultados e dados retornados','Sugerir nome'])expect(html).toContain(titulo)
  expect(html).not.toContain('Consultar por CNPJ')
  expect(html).not.toContain('name="cep"')
})
