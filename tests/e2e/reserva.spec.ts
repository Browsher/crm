import { expect, test, type Page } from '@playwright/test'

async function entrar(page: Page, apelido: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido.toLowerCase()}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/')
}

async function reservar(page: Page, nome: string, cnae: string) {
  await page.goto(`/fila/localizar?nome=${encodeURIComponent(nome)}&cnae=${cnae}`)
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: nome, exact: true }) })
  await card.getByRole('button', { name: 'Reservar para ligar', exact: true }).click()
  await expect(page).toHaveURL(/\/fila\?/)
  await expect(page.getByRole('heading', { name: nome, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar resultado', exact: true }).click()
}

test('reserva escolhida troca com confirmação e recusa contexto antigo de outra aba', async ({ page, context }) => {
  await entrar(page, 'reservaAe2e')
  // Nome comum permite que Próxima encontre B usando os mesmos filtros.
  await page.goto('/fila/localizar?nome=Reserva%20E2E&cnae=7654321')
  await page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Reserva E2E A', exact: true }) })
    .getByRole('button', { name: 'Reservar para ligar', exact: true }).click()
  await expect(page).toHaveURL(/\/fila\?/)
  await expect(page.getByText('11987650101', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar resultado', exact: true }).click()
  await page.getByLabel('Nota', { exact: true }).fill('Rascunho de A')
  await page.getByLabel('Combinado (opcional)', { exact: true }).fill('Ligar amanhã')
  await page.getByLabel('Data combinada (opcional)', { exact: true }).fill('2026-10-01')
  await page.getByRole('link', { name: 'Localizar empresa', exact: true }).click()
  await page.getByLabel('Nome', { exact: true }).fill('Reserva E2E')
  await page.getByRole('button', { name: 'Consultar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reserva E2E B', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar para a fila', exact: true }).click()
  await expect(page).toHaveURL(/cnae=7654321/)
  await page.getByRole('button', { name: 'Registrar resultado', exact: true }).click()
  await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Rascunho de A')
  const antiga = await context.newPage()
  await antiga.goto(page.url())
  await antiga.getByRole('button', { name: 'Registrar resultado', exact: true }).click()
  await antiga.getByLabel('Nota', { exact: true }).fill('Rascunho da aba antiga')

  await page.getByRole('button', { name: 'Próxima', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reserva E2E A', exact: true })).toBeVisible()
  await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Rascunho de A')

  await page.getByRole('button', { name: 'Próxima', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar e continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reserva E2E B', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar resultado', exact: true }).click()
  await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Combinado (opcional)', { exact: true })).toHaveValue('')

  await antiga.getByRole('button', { name: 'Próxima', exact: true }).click()
  await antiga.getByRole('dialog').getByRole('button', { name: 'Descartar e continuar', exact: true }).click()
  await expect.poll(() => antiga.locator('textarea').evaluateAll(campos => campos.some(c => c instanceof HTMLTextAreaElement && c.value === 'Rascunho da aba antiga'))).toBe(true)
  await expect(antiga.getByRole('main')).toContainText(/alterad|outra aba/i)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Reserva E2E B', exact: true })).toBeVisible()
  await antiga.close()
  await page.getByRole('button', { name: 'Registrar resultado', exact: true }).click()
  await page.getByLabel('Nota', { exact: true }).fill('Descarte registrado')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page).toHaveURL(/\/fila\/localizar/)
  await expect(page.getByText('11987650102', { exact: true })).not.toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Nota', exact: true })).toHaveCount(0)
  await page.goto('/fila/localizar')
  await expect(page.getByRole('heading', { name: 'Empresas recentes', exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').first().getByRole('heading', { name: 'Reserva E2E B', exact: true })).toBeVisible()
})

test('fila sem próxima e expiração visual preservam texto sem renovação automática', async ({ page }) => {
  await page.clock.install()
  await entrar(page, 'reservaBe2e')
  await reservar(page, 'Reserva Unica E2E', '1234567')
  await page.getByLabel('Nota', { exact: true }).fill('Texto que precisa sobreviver')
  await page.getByRole('button', { name: 'Próxima', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar e continuar', exact: true }).click()
  await expect(page.getByRole('main')).toContainText('Nenhuma outra empresa disponível')
  await expect(page.getByRole('heading', { name: 'Reserva Unica E2E', exact: true })).toBeVisible()
  await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Texto que precisa sobreviver')

  // Avança somente o relógio do navegador. A expiração efetiva e nova reserva
  // no PostgreSQL são cobertas pela integração; aqui provamos o bloqueio visual.
  let envios = 0
  page.on('request', request => { if (request.method() === 'POST') envios++ })
  await page.clock.fastForward(31 * 60 * 1000)
  await expect(page.getByRole('button', { name: 'Registrar', exact: true })).toBeDisabled()
  await expect(page.getByText('11987650103', { exact: true })).not.toBeVisible()
  await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Texto que precisa sobreviver')
  expect(envios).toBe(0)
  await page.getByRole('button', { name: 'Tentar reservar novamente', exact: true }).click()
  await expect.poll(() => envios).toBeGreaterThan(0)
  await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Texto que precisa sobreviver')
})
