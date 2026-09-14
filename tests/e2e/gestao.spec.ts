import { expect, test } from '@playwright/test'

test('gestor só acessa administração, inclusive por URL direta, e início funciona nos dois temas', async ({ page }) => {
  await page.goto('/gestao')
  await expect(page).toHaveURL('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/gestao')
  const menu = page.getByRole('navigation', { name: 'Navegação do CRM' })
  for (const nome of ['Prospecção', 'Carteira', 'Meu dia']) await expect(menu.getByRole('link', { name: nome, exact: true })).toHaveCount(0)
  for (const rota of ['/meu-dia', '/carteira', '/carteira/00000000-0000-4000-8000-000000000001', '/fila', '/fila/localizar', '/fila/localizar/00000000-0000-4000-8000-000000000001']) {
    await page.goto(rota)
    await expect(page).toHaveURL('/gestao')
    await expect(page.getByRole('heading', { name: 'Gestão', exact: true })).toBeVisible()
  }
  for (const [acao, rota] of [['Gerenciar empresas', '/empresas'], ['Gerenciar grupos', '/empresas/grupos'], ['Gerenciar usuários', '/usuarios']]) {
    await page.getByRole('link', { name: acao, exact: true }).click()
    await expect(page).toHaveURL(rota)
    await page.getByRole('navigation').getByRole('link', { name: 'Início', exact: true }).click()
    await expect(page).toHaveURL('/gestao')
  }
  for (const largura of [1280, 390]) {
    await page.setViewportSize({ width: largura, height: 900 })
    for (const tema of ['light', 'dark']) {
      await page.getByLabel('Tema da Gestão').selectOption(tema)
      await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `test-results/gestao-${largura}-${tema}.png`, fullPage: true })
    }
  }
})

test('vendedor continua na agenda e não entra na gestão', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('vendedore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/gestao')
  await expect(page).toHaveURL('/meu-dia')
  const menu = page.getByRole('navigation')
  for (const nome of ['Empresas', 'Grupos', 'Usuários']) await expect(menu.getByRole('link', { name: nome, exact: true })).toHaveCount(0)
  for (const nome of ['Prospecção', 'Carteira', 'Meu dia']) await expect(menu.getByRole('link', { name: nome, exact: true })).toBeVisible()
})
