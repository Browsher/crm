import { expect, test, type Page } from '@playwright/test'

async function entrar(page: Page, apelido: string, senha = 'Senha-e2e-2026') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('visitante é encaminhado ao login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login')
  await page.goto('/usuarios')
  await expect(page).toHaveURL('/login')
})

test('senha incorreta não abre página protegida', async ({ page }) => {
  await entrar(page, 'invalidoe2e', 'Senha-incorreta-2026')
  await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha não conferem.' })).toBeVisible()
  await page.goto('/usuarios')
  await expect(page).toHaveURL('/login')
})

test('gestor entra, acessa usuários e encerra a sessão', async ({ page }) => {
  await entrar(page, 'gestore2e')
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/usuarios')
  await expect(page.getByRole('heading', { name: 'Usuários', exact: true })).toBeVisible()
  await page.goto('/')
  await expect(page).toHaveURL('/meu-dia')
  await expect(page.getByRole('heading', { name: 'Meu dia', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Início', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ir para Prospecção', exact: true })).toHaveAttribute('href', '/fila')
  await expect(page.getByRole('link', { name: 'Ver carteira completa', exact: true })).toHaveAttribute('href', '/carteira')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await page.goto('/usuarios')
  await expect(page).toHaveURL('/login')
})

test('vendedor autenticado não administra usuários', async ({ page }) => {
  await entrar(page, 'vendedore2e')
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/usuarios')
  await expect(page).toHaveURL('/meu-dia')
  await expect(page.getByRole('heading', { name: 'Meu dia', exact: true })).toBeVisible()
})

test('senha provisória obriga troca e a antiga deixa de autenticar', async ({ page }) => {
  await entrar(page, 'provisorioe2e')
  await expect(page).toHaveURL('/trocar-senha')
  await page.goto('/')
  await expect(page).toHaveURL('/trocar-senha')
  await page.goto('/usuarios')
  await expect(page).toHaveURL('/trocar-senha')
  await page.getByLabel('Senha atual').fill('Senha-e2e-2026')
  await page.getByLabel('Nova senha').fill('Senha-nova-e2e-2026')
  await page.getByRole('button', { name: 'Trocar senha', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await entrar(page, 'provisorioe2e')
  await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha não conferem.' })).toBeVisible()
  await entrar(page, 'provisorioe2e', 'Senha-nova-e2e-2026')
  await expect(page).toHaveURL('/meu-dia')
})
