// @vitest-environment jsdom
import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
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

test('refs e valores dos controles chegam ao formulário sem perder seleção ou leitura', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const input = createRef<HTMLInputElement>()
  const nota = createRef<HTMLTextAreaElement>()
  const estado = createRef<HTMLSelectElement>()
  const botao = createRef<HTMLButtonElement>()
  let acionamentos = 0
  try {
    await act(async () => root.render(<form>
      <Label htmlFor="contrato-nome">Nome</Label>
      <Input ref={input} id="contrato-nome" name="nome" defaultValue="Aurora" />
      <Input name="consentimento" type="checkbox" defaultChecked value="sim" />
      <Textarea ref={nota} name="nota" value="Texto selecionável" readOnly rows={8} aria-describedby="ajuda-nota" />
      <span id="ajuda-nota">Pode copiar</span>
      <NativeSelect ref={estado} name="uf" defaultValue="SP"><option value="SP">São Paulo</option></NativeSelect>
      <Button ref={botao} type="button" onClick={() => acionamentos++}>Registrar</Button>
    </form>))
    input.current!.focus()
    expect(document.activeElement).toBe(input.current)
    expect(nota.current!.readOnly).toBe(true)
    expect(nota.current!.rows).toBe(8)
    expect(nota.current!.getAttribute('aria-describedby')).toBe('ajuda-nota')
    nota.current!.select()
    expect(nota.current!.selectionEnd).toBe('Texto selecionável'.length)
    const dados = new FormData(container.querySelector('form')!)
    expect([...dados.entries()]).toEqual([
      ['nome', 'Aurora'], ['consentimento', 'sim'], ['nota', 'Texto selecionável'], ['uf', 'SP'],
    ])
    expect(estado.current!.value).toBe('SP')
    await act(async () => botao.current!.click())
    expect(acionamentos).toBe(1)
    await act(async () => root.render(<Button ref={botao} disabled onClick={() => acionamentos++}>Registrar</Button>))
    await act(async () => botao.current!.click())
    expect(acionamentos).toBe(1)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})