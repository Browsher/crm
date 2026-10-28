// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { BuscaDialogo } from './busca-dialogo'
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove() })
async function montar(carregarAcao: Parameters<typeof BuscaDialogo>[0]['carregarAcao']) {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<BuscaDialogo nome="Armarinhos" carregarAcao={carregarAcao} />))
  const gatilho = host.querySelector('button')!
  return gatilho
}
test('só lê ao abrir, mostra carregamento e descarta resposta de abertura anterior', async () => {
  let concluir!: (r: { ok: true; conteudo: string }) => void
  const carregar = vi.fn().mockImplementationOnce(() => new Promise(r => { concluir = r })).mockResolvedValue({ ok: true, conteudo: 'Dados atuais' })
  const gatilho = await montar(carregar)
  expect(carregar).not.toHaveBeenCalled()
  await act(async () => gatilho.click())
  expect(document.querySelector('[role="status"]')?.textContent).toBe('Carregando busca…')
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Fechar"]')!.click())
  await act(async () => gatilho.click())
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Dados atuais')
  await act(async () => concluir({ ok: true, conteudo: 'Dados atrasados' }))
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Dados atrasados')
})
test('falha de leitura permite tentar novamente no mesmo pop-up', async () => {
  const carregar = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ ok: true, conteudo: 'Empresas salvas' })
  const gatilho = await montar(carregar)
  await act(async () => gatilho.click())
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível carregar')
  const tentar = [...document.querySelectorAll('button')].find(b => b.textContent === 'Tentar novamente')!
  await act(async () => tentar.click())
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Empresas salvas')
  expect(carregar).toHaveBeenCalledTimes(2)
})

test('resultado inicial abre sem action extra e não reabre após revalidação', async () => {
  const carregar = vi.fn().mockResolvedValue({ ok: true, conteudo: 'Resultado relido' })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  const props = { nome: 'Resultado recém-salvo', carregarAcao: carregar, abrirInicialmente: true, conteudoInicial: <p>Resultado já salvo</p>, rotulo: 'Ver resultados' }
  await act(async () => root.render(<BuscaDialogo {...props} />))
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Resultado já salvo')
  expect(carregar).not.toHaveBeenCalled()
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Fechar"]')!.click())
  await act(async () => root.render(<BuscaDialogo {...props} conteudoInicial={<p>Revalidado</p>} />))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  const gatilho = host.querySelector<HTMLButtonElement>('[aria-label="Ver resultados: Resultado recém-salvo"]')!
  expect(gatilho).not.toBeNull()
  await act(async () => gatilho.click())
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Resultado relido')
  expect(carregar).toHaveBeenCalledTimes(1)
})
