import { expect, type Page } from '@playwright/test'

export async function abrirLeitura(page: Page) {
  const lateral = page.locator('[data-painel-lateral]')
  if (new URL(page.url()).pathname.startsWith('/carteira/')) return
  await expect(lateral).toBeVisible()
  await expect(lateral.locator('[data-painel-corpo]')).toHaveAttribute('aria-busy', 'false')
  const menu = lateral.getByRole('button', { name: 'Atendimento e próximo passo', exact: true })
  if (await menu.isVisible()) await menu.click()
}
