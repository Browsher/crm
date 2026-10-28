// @vitest-environment jsdom
import { act, createRef } from 'react'
import { Choice } from './choice'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'


test('Choice conserva transporte nativo, ref, label e grupo de radio', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const ref = createRef<HTMLInputElement>()
  let alteracoes = 0
  try {
    await act(async () => root.render(<form>
      <label htmlFor="telefone">Telefone</label><Choice ref={ref} id="telefone" type="checkbox" name="contato" value="telefone" defaultChecked required aria-invalid onChange={() => alteracoes++} aria-describedby="ajuda" />
      <span id="ajuda">Contato disponível</span>
      <label><Choice type="radio" name="regiao" value="SP" defaultChecked />São Paulo</label>
      <label><Choice type="radio" name="regiao" value="RJ" />Rio de Janeiro</label>
      <Choice type="checkbox" name="ignorado" value="sim" defaultChecked disabled />
    </form>))
    const form = host.querySelector('form')!
    expect(new FormData(form).getAll('contato')).toEqual(['telefone'])
    expect(ref.current).toBe(host.querySelector('#telefone'))
    expect(ref.current!.getAttribute('aria-describedby')).toBe('ajuda')
    expect(ref.current!.getAttribute('aria-invalid')).toBe('true')
    expect(ref.current!.checkValidity()).toBe(true)
    await act(async () => ref.current!.click())
    expect(new FormData(form).getAll('contato')).toEqual([])
    expect(ref.current!.checkValidity()).toBe(false)
    await act(async () => host.querySelector<HTMLLabelElement>('label')!.click())
    expect(new FormData(form).getAll('contato')).toEqual(['telefone'])
    expect(alteracoes).toBe(2)
    const radios = host.querySelectorAll<HTMLInputElement>('input[type=radio]')
    await act(async () => radios[1].click())
    expect(radios[0].checked).toBe(false)
    expect(new FormData(form).get('regiao')).toBe('RJ')
    expect(new FormData(form).has('ignorado')).toBe(false)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
