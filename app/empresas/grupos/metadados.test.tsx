import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { MetadadosGrupo } from './metadados'
vi.mock('./acoes', () => ({ atualizarMetadadosGrupoAcao: vi.fn() }))
test('grupo antigo mostra nulos sem inventar contexto e correção exige resumo e origem', () => {
  const html = renderToStaticMarkup(<MetadadosGrupo id="grupo" descricao={null} origem={null} criterios={null} />)
  expect(html).toContain('Origem não informada')
  expect(html).toContain('Corrigir contexto da lista')
  for (const campo of ['descricao', 'origem', 'criterios']) {
    const elemento = html.match(new RegExp(`<textarea[^>]*name="${campo}"[^>]*>`))?.[0]
    expect(elemento).toBeDefined()
    if (campo !== 'criterios') expect(elemento).toContain('required=""')
    expect(elemento?.toLowerCase()).not.toContain('maxlength')
  }
})
test('contexto preserva os três textos conhecidos, inclusive caracteres Unicode', () => {
  const html = renderToStaticMarkup(<MetadadosGrupo id="grupo" descricao="📷 Mooca" origem="Google Maps" criterios="Telefone disponível" />)
  expect(html).toContain('📷 Mooca')
  expect(html).toContain('Google Maps')
  expect(html).toContain('Telefone disponível')
})
