import { expect, test } from '@playwright/test'
import { comBancoGrupos } from './dados-grupos'

async function fotografia() {
  return comBancoGrupos(async c => {
    const estado = []
    for (const tabela of ['empresa', 'grupo_importacao', 'grupo_importacao_empresa', 'empresa_origem_google']) estado.push((await c.query('SELECT * FROM '+tabela+' ORDER BY 1,2')).rows)
    return estado
  })
}

test('endereço antigo encaminha gestor sem formulário, atalhos ou escrita', async ({ page }) => {
  const antes = await fotografia()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/gestao')
  await page.goto('/empresas/importar')
  await expect(page).toHaveURL('/empresas')
  await expect(page.locator('input[type=file]')).toHaveCount(0)
  for (const caminho of ['/empresas', '/empresas?cidade=3550308', '/empresas/grupos', '/empresas/grupos?pagina=999']) {
    await page.goto(caminho)
    await expect(page.locator('a[href="/empresas/importar"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Conferir arquivo|Confirmar importação/ })).toHaveCount(0)
  }
  expect(await fotografia()).toEqual(antes)
})

test('visitante continua sujeito à autenticação no endereço antigo', async ({ page }) => {
  await page.goto('/empresas/importar')
  await expect(page).toHaveURL('/login')
})
