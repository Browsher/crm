import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import { NativeSelect } from './native-select'
import { Textarea } from './textarea'

describe('componentes de formulario', () => {
  test('botao desabilitado preserva a semantica nativa', () => {
    const html = renderToStaticMarkup(<Button disabled>Reservar</Button>)

    expect(html).toMatch(/<button[^>]*disabled=""/)
    expect(html).toContain('Reservar')
  })

  test('botao asChild compoe um link sem criar botao aninhado', () => {
    const html = renderToStaticMarkup(
      <Button asChild variant="outline"><a href="/fila">Voltar à fila</a></Button>,
    )

    expect(html).toMatch(/^<a[^>]*href="\/fila"/)
    expect(html).not.toContain('<button')
  })

  test('label mantem a associacao explicita com o campo', () => {
    const html = renderToStaticMarkup(<><Label htmlFor="nome">Nome</Label><Input id="nome" /></>)

    expect(html).toContain('for="nome"')
    expect(html).toContain('id="nome"')
  })

  test('campos preservam aria-invalid e atributos nativos', () => {
    const html = renderToStaticMarkup(<>
      <Input name="nome" aria-invalid aria-describedby="nome-erro" required />
      <Textarea name="nota" readOnly maxLength={500} />
      <NativeSelect name="uf" defaultValue="SP" aria-label="Estado">
        <option value="SP">SP</option>
      </NativeSelect>
    </>)

    expect(html).toMatch(/<input[^>]*aria-invalid="true"[^>]*aria-describedby="nome-erro"/)
    expect(html).toMatch(/<textarea[^>]*readOnly=""[^>]*maxLength="500"/)
    expect(html).toMatch(/<select[^>]*name="uf"[^>]*aria-label="Estado"/)
    expect(html).toContain('<option value="SP" selected="">SP</option>')
  })
})
