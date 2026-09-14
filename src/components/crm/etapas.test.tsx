import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Etapas } from './etapas'

const itens = [
  { id: 'enviar', rotulo: 'Enviar' },
  { id: 'conferir', rotulo: 'Conferir' },
  { id: 'concluir', rotulo: 'Concluir' },
] as const

test('identifica a navegação e somente a etapa atual', () => {
  const html = renderToStaticMarkup(<Etapas rotulo="Etapas da importação" atual="conferir" itens={itens} />)
  expect(html).toContain('aria-label="Etapas da importação"')
  expect(html.match(/aria-current="step"/g)).toHaveLength(1)
  expect(html).toMatch(/<div aria-current="step"><span>Conferir<\/span><\/div>/)
})

test('sem ações fornecidas, os indicadores são texto sem navegação', () => {
  const html = renderToStaticMarkup(<Etapas rotulo="Etapas da importação" atual="enviar" itens={itens} />)
  expect(html).toContain('<span>Conferir</span>')
  expect(html).toContain('<span>Concluir</span>')
  expect(html).not.toContain('<a ')
  expect(html).not.toContain('<button')
})

test('renderiza a ação de retorno fornecida pela tela', () => {
  const html = renderToStaticMarkup(<Etapas rotulo="Etapas da importação" atual="conferir" itens={[
    { ...itens[0], acao: <button type="button">Enviar</button> }, itens[1], itens[2],
  ]} />)
  expect(html).toContain('<button type="button">Enviar</button>')
  expect(html).toContain('<span>Concluir</span>')
})
