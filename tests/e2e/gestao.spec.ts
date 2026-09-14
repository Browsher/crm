import { expect, test } from '@playwright/test'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('Execute pelo harness local de E2E')
  exigirAdminLocal(url)
  await comAdmin(url, async cliente => {
    await cliente.query('BEGIN')
    try {
      const usuarios = await cliente.query<{ id: string; nome: string }>(`INSERT INTO usuario(nome,email,papel,ativo) VALUES
        ('Ana Lima','dashboardana@teste.local','vendedor',true),
        ('Bruno Costa','dashboardbruno@teste.local','vendedor',true),
        ('Vendedor desativado','dashboardinativo@teste.local','vendedor',false) RETURNING id,nome`)
      for (const [indice, usuario] of usuarios.rows.entries()) {
        const empresa = await cliente.query<{ id: string }>(`INSERT INTO empresa(cnpj,razao_social,telefone)
          VALUES($1,$2,'11999999999') RETURNING id`, [`90909090000${String(indice).padStart(3, '0')}`, ['Aurora Comércio', 'Brisa Serviços', 'Cadastro Inativo'][indice]])
        await cliente.query('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [empresa.rows[0].id, usuario.id])
        await cliente.query("SELECT set_config('app.usuario_id',$1,true)", [usuario.id])
        await cliente.query(`INSERT INTO contato(empresa_id,tipo,proximo_passo,proximo_passo_data)
          VALUES($1,'acompanhamento','Conversar com o responsável',(now() AT TIME ZONE 'America/Sao_Paulo')::date + $2::int)`, [empresa.rows[0].id, indice === 0 ? -1 : 0])
      }
      await cliente.query('COMMIT')
    } catch (erro) { await cliente.query('ROLLBACK'); throw erro }
  })
})

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
  const equipe = page.getByRole('region', { name: 'Vendedores ativos', exact: true })
  const ana = equipe.getByRole('article', { name: 'Ana Lima', exact: true })
  await expect(ana.locator('dd')).toHaveText(['1', '1', '0'])
  await expect(ana.locator('p strong')).toHaveText('1')
  await expect(equipe.getByRole('article', { name: 'Vendedor desativado', exact: true })).toHaveCount(0)
  const atividade = page.getByRole('region', { name: 'Atividade recente', exact: true })
  await expect(atividade).toContainText('Aurora Comércio')
  await expect(atividade).not.toContainText('Cadastro Inativo')
  await expect(equipe.getByRole('article', { name: 'meudiae2e', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Resumo da equipe' }).getByRole('heading', { name: 'Retornos hoje', exact: true })).toBeVisible()
  await expect(equipe.getByRole('article', { name: 'meudiae2e', exact: true })).toContainText('Contatos registrados hoje')
  await page.getByRole('link', { name: 'Atualizar', exact: true }).click()
  await expect(equipe.getByRole('article', { name: 'meudiae2e', exact: true })).toBeVisible()
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
