import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { EtapasFila } from './etapas'

const filtros = { nome: 'Cliente', cnae: null, uf: 'SP', cidade: null, bairro: null, pagina: 2 }

test('em Puxar, etapas futuras não são links nem botões', () => {
  const html = renderToStaticMarkup(<EtapasFila etapa="puxar" filtros={filtros} />)
  expect(html).toContain('aria-current="step"')
  expect(html).not.toContain('<a ')
  expect(html).not.toContain('<button')
})

test('em Registrar, volta à consulta e à busca preservando filtros', () => {
  const html = renderToStaticMarkup(<EtapasFila etapa="registrar" filtros={filtros} onConsultar={() => {}} />)
  expect(html).toContain('nome=Cliente')
  expect(html).toContain('uf=SP')
  expect(html).toContain('pagina=2')
  expect(html).toMatch(/<button[^>]*>Consultar<\/button>/)
  expect(html).not.toMatch(/<button[^>]*>Registrar<\/button>/)
})

test('durante gravação, não permite sair pelas etapas', () => {
  const html = renderToStaticMarkup(<EtapasFila etapa="registrar" filtros={filtros} onConsultar={() => {}} bloqueado />)
  expect(html).not.toContain('<a ')
  expect(html).not.toContain('<button')
})
