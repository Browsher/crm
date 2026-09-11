import { expect, test, type Page } from '@playwright/test'

async function entrar(page: Page, apelido: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/')
}

test('perfil não reserva, recentes persistem e pertencem somente ao usuário', async ({ page, browser }) => {
  await entrar(page, 'recenteae2e')
  await page.goto('/fila/localizar')
  await expect(page.getByRole('heading', { name: 'Sugestões de empresas', exact: true })).toBeVisible()
  await page.getByLabel('Nome', { exact: true }).fill('Consulta E2E 01')
  await page.getByRole('button', { name: 'Consultar', exact: true }).click()
  const resultado = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Consulta E2E 01', exact: true }) })
  const perfil = await resultado.getByRole('link', { name: 'Ver perfil', exact: true }).getAttribute('href')
  expect(perfil).toBeTruthy()
  const respostaSemJavascript = await page.request.get(perfil!)
  expect(respostaSemJavascript.status()).toBe(200)
  expect(await respostaSemJavascript.text()).not.toContain('11987650001')
  await page.goto('/fila/localizar')
  await expect(page.getByRole('heading', { name: 'Sugestões de empresas', exact: true })).toBeVisible()
  const visitaGravada = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.startsWith('/fila/localizar/'))
  await page.goto(perfil!)
  await visitaGravada
  await expect(page).toHaveURL(/\/fila\/localizar\/[0-9a-f-]{36}/)
  await expect(page.getByRole('heading', { name: 'Consulta E2E 01', exact: true })).toBeVisible()
  await expect(page.getByText('Com outro vendedor', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reservar para ligar', exact: true })).toHaveCount(0)
  for (const privado of ['11987650001', 'contato-secreto@teste.local', 'Pessoa privada E2E']) {
    expect(await page.content()).not.toContain(privado)
  }
  await page.getByRole('link', { name: 'Voltar para localizar', exact: true }).click()
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Empresas recentes', exact: true })).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(1)
  const novaVisitaGravada = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.startsWith('/fila/localizar/'))
  await page.getByRole('link', { name: 'Ver perfil', exact: true }).click()
  await novaVisitaGravada
  await page.getByRole('link', { name: 'Voltar para localizar', exact: true }).click()
  await expect(page.getByRole('listitem')).toHaveCount(1)
  await page.goto('/fila')
  await expect(page).toHaveURL(/\/fila\/localizar/)
  await expect(page.getByRole('button', { name: 'Buscar cliente', exact: true })).toBeVisible()

  const outroComputador = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const novaPagina = await outroComputador.newPage()
    await entrar(novaPagina, 'recenteae2e')
    await novaPagina.goto('/fila/localizar')
    await expect(novaPagina.getByRole('heading', { name: 'Empresas recentes', exact: true })).toBeVisible()
    await expect(novaPagina.getByRole('heading', { name: 'Consulta E2E 01', exact: true })).toBeVisible()
  } finally { await outroComputador.close() }

  const outroUsuario = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const novaPagina = await outroUsuario.newPage()
    await entrar(novaPagina, 'recentebe2e')
    await novaPagina.goto('/fila/localizar')
    await expect(novaPagina.getByRole('heading', { name: 'Sugestões de empresas', exact: true })).toBeVisible()
    await expect(novaPagina.getByRole('heading', { name: 'Consulta E2E 01', exact: true })).toHaveCount(0)
  } finally { await outroUsuario.close() }
})
