import { expect, test, type Page } from '@playwright/test'


async function entrar(page: Page, apelido = 'redesigne2e') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(apelido === 'gestore2e' ? '/gestao' : '/meu-dia')
}

test('acesso à busca e localização convivem no redesign da Prospecção', async ({ page }) => {
  await entrar(page)
  await page.goto('/fila')
  await expect(page.getByRole('link', { name: 'Localizar empresa', exact: true }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Buscar empresas', exact: true }).click()
  await expect(page).toHaveURL('/fila/buscar')
  await expect(page.getByRole('heading', { name: 'Buscar empresas', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Localização atual' })).toContainText('Buscar empresas')
  await page.getByRole('link', { name: 'Busca no Google', exact: true }).click()
  await expect(page).toHaveURL('/fila/buscar?fonte=google')
  await page.getByRole('link', { name: 'Busca do banco de dados', exact: true }).click()
  await expect(page).toHaveURL('/fila/buscar?fonte=banco')
})


