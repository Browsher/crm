import { expect, test } from '@playwright/test'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

let empresaId: string
test.beforeAll(async () => {
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('Execute pelo harness de E2E local')
  exigirAdminLocal(url)
  await comAdmin(url, async cliente => {
    await cliente.query('BEGIN')
    try {
      const { rows: [dono] } = await cliente.query<{ id: string }>("SELECT id FROM usuario WHERE email='vendedore2e@teste.local'")
      const { rows: [empresa] } = await cliente.query<{ id: string }>(`INSERT INTO empresa(cnpj,razao_social,telefone,contato_nome,email)
        VALUES('90909090909901','Perfil Gestor Aurora','11988776655','Marina','marina@teste.local') RETURNING id`)
      empresaId = empresa.id
      await cliente.query('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [empresaId,dono.id])
      await cliente.query(`WITH g AS (INSERT INTO grupo_importacao(nome) VALUES('Origem da ficha do gestor') RETURNING id)
        INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) SELECT id,$1 FROM g`, [empresaId])
      await cliente.query("SELECT set_config('app.usuario_id',$1,true)", [dono.id])
      await cliente.query(`INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data)
        VALUES($1,'acompanhamento','Conversa de teste registrada','Telefonar amanhã',(now() AT TIME ZONE 'America/Sao_Paulo')::date+1)`, [empresaId])
      await cliente.query('COMMIT')
    } catch (erro) { await cliente.query('ROLLBACK'); throw erro }
  })
})

test('gestor abre ficha pela lista, consulta sem ações e volta mantendo busca', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/gestao')
  await page.goto('/empresas?q=Perfil+Gestor+Aurora&pagina=1')
  await page.getByRole('link', { name: 'Perfil Gestor Aurora', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/empresas/${empresaId}\\?`))
  await expect(page.getByRole('heading', { name: 'Perfil Gestor Aurora' })).toBeVisible()
  await expect(page.getByText('Marina', { exact: true })).toBeVisible()
  await expect(page.getByText('(11) 98877-6655', { exact: true })).toBeVisible()
  await expect(page.getByText('Conversa de teste registrada', { exact: true })).toBeVisible()
  await expect(page.getByText('Registrado por vendedore2e', { exact: true })).toBeVisible()
  await expect(page.getByText('Origem da ficha do gestor', { exact: true })).toBeVisible()
  await expect(page.locator('main form')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Registrar atendimento' })).toHaveCount(0)
  for (const largura of [1280,390]) {
    await page.setViewportSize({ width: largura, height: 900 })
    for (const tema of ['light','dark']) {
      await page.getByRole('combobox').selectOption(tema)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `test-results/empresa-perfil-${largura}-${tema}.png`, fullPage: true })
    }
  }
  await page.getByRole('link', { name: 'Voltar para empresas', exact: true }).click()
  await expect(page).toHaveURL('/empresas?q=Perfil+Gestor+Aurora&pagina=1')
  await page.goto('/empresas/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('404', { exact: true })).toBeVisible()
})

test('vendedor não abre ficha administrativa mesmo sendo responsável', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('vendedore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto(`/empresas/${empresaId}`)
  await expect(page).toHaveURL('/meu-dia')
  await expect(page.getByRole('heading', { name: 'Perfil Gestor Aurora' })).toHaveCount(0)
})
