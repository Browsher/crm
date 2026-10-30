import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
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
        ('Vendedor desativado','dashboardinativo@teste.local','vendedor',true) RETURNING id,nome`)
      for (const [indice, usuario] of usuarios.rows.entries()) {
        const empresa = await cliente.query<{ id: string }>(`INSERT INTO empresa(cnpj,razao_social,telefone)
          VALUES($1,$2,'11999999999') RETURNING id`, [`90909090000${String(indice).padStart(3, '0')}`, ['Aurora Comércio', 'Brisa Serviços', 'Cadastro Inativo'][indice]])
        await cliente.query('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [empresa.rows[0].id, usuario.id])
        await cliente.query("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial,iniciada_em) VALUES($1,$2,'legado',now())", [empresa.rows[0].id, usuario.id])
        await cliente.query("WITH g AS (INSERT INTO grupo_importacao(nome) VALUES('Origem dashboard') RETURNING id) INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) SELECT id,$1 FROM g", [empresa.rows[0].id])
        await cliente.query('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,100,gen_random_uuid())', [empresa.rows[0].id, usuario.id])
        await cliente.query("SELECT set_config('app.usuario_id',$1,true)", [usuario.id])
        await cliente.query(`INSERT INTO contato(empresa_id,tipo,proximo_passo,proximo_passo_data)
          VALUES($1,'acompanhamento','Conversar com o responsável',(now() AT TIME ZONE 'America/Sao_Paulo')::date + $2::int)`, [empresa.rows[0].id, indice === 0 ? -1 : 0])
        await cliente.query('UPDATE empresa_vinculo SET agenda_contato_id=(SELECT id FROM contato WHERE empresa_id=$1) WHERE empresa_id=$1', [empresa.rows[0].id])
        if (indice === 2) await cliente.query('UPDATE usuario SET ativo=false WHERE id=$1', [usuario.id])
      }
      await cliente.query('COMMIT')
    } catch (erro) { await cliente.query('ROLLBACK'); throw erro }
  })
})

test('gestor só acessa administração, inclusive por URL direta, e início funciona nos dois temas', async ({ page }) => {
  test.setTimeout(60_000)
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
  await expect(page.getByRole('navigation', { name: 'Atalhos administrativos' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Listas', exact: true })).toHaveAttribute('href', '/empresas/grupos')
  for (const [acao, rota] of [['Empresas', '/empresas'], ['Usuários', '/usuarios']]) {
    await menu.getByRole('link', { name: acao, exact: true }).click()
    await expect(page).toHaveURL(rota)
    await page.getByRole('navigation').getByRole('link', { name: 'Início', exact: true }).click()
    await expect(page).toHaveURL('/gestao')
  }
  const equipe = page.getByRole('region', { name: 'Vendedores ativos', exact: true })
  const ana = equipe.getByRole('row').filter({ has: page.getByRole('heading', { name: 'Ana Lima', exact: true }) })
  await expect(ana.getByRole('cell')).toHaveText([/Ana Lima/, '1', '1', '0', '1'])
  await expect(equipe.getByRole('row').filter({ hasText: 'Vendedor desativado' })).toHaveCount(0)
  const atividade = page.getByRole('region', { name: 'Atividade recente', exact: true })
  await expect(atividade).toContainText('Aurora Comércio')
  await expect(atividade).not.toContainText('Cadastro Inativo')
  await expect(equipe.getByRole('row').filter({ hasText: 'meudiae2e' })).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Resumo da equipe' }).getByRole('heading', { name: 'Retornos hoje', exact: true })).toBeVisible()
  await expect(equipe.getByRole('columnheader', { name: 'Contatos registrados hoje', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Atualizar', exact: true }).click()
  await expect(equipe.getByRole('row').filter({ hasText: 'meudiae2e' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Resumo da equipe' }).locator('[data-slot=card]')).toHaveCount(4)
  for (const largura of [1920, 1280, 1200, 1100, 820, 390]) {
    await page.setViewportSize({ width: largura, height: 900 })
    for (const tema of ['light', 'dark']) {
      await page.getByLabel('Tema da Gestão').selectOption(tema)
      await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.getByRole('main')).toHaveCSS('padding-left', largura <= 820 ? '16px' : '32px')
      const indicador = page.getByRole('region', { name: 'Resumo da equipe' }).locator('[data-slot=card]').first()
      await expect(indicador).toHaveCSS('border-radius', '10px')
      await expect(indicador).toHaveCSS('padding-top', largura <= 820 ? '20px' : '24px')
      const a = (await equipe.boundingBox())!
      const b = (await atividade.boundingBox())!
      expect(Math.min(a.x + a.width, b.x + b.width) <= Math.max(a.x, b.x) + 1 || Math.min(a.y + a.height, b.y + b.height) <= Math.max(a.y, b.y) + 1).toBe(true)
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/gestao-${largura}-${tema}.png`, fullPage: true })
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
  for (const nome of ['Empresas', 'Listas', 'Coletas do Google', 'Usuários']) await expect(menu.getByRole('link', { name: nome, exact: true })).toHaveCount(0)
  for (const nome of ['Prospecção', 'Carteira', 'Meu dia']) await expect(menu.getByRole('link', { name: nome, exact: true })).toBeVisible()
})


test('fallbacks da Gestão herdam o tema global sem depender do Shell', async ({ page }) => {
  // Usa os componentes reais, como a fixture de design-system.spec.ts.
  // CSS Modules são irrelevantes para esta prova de herança dos tokens globais.
  const html = execFileSync(process.execPath, ['--import', 'tsx', '--eval', `
    require.extensions['.css'] = modulo => { modulo.exports = {} }
    const { createElement: h } = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    const Loading = require('./app/gestao/loading').default
    const Erro = require('./app/gestao/error').default
    process.stdout.write(renderToStaticMarkup(h('div', null,
      h('section', { id: 'espera' }, h(Loading)),
      h('section', { id: 'falha' }, h(Erro)),
    )))
  `], { encoding: 'utf8' })
  await page.goto('/login')
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/)
  await page.evaluate(conteudo => {
    const raiz = document.createElement('div')
    raiz.id = 'fallbacks-gestao'
    raiz.style.cssText = 'display:grid;gap:24px;padding:24px'
    raiz.innerHTML = conteudo
    document.body.replaceChildren(raiz)
  }, html)
  await expect(page.getByRole('navigation', { name: 'Navegação do CRM' })).toHaveCount(0)
  for (const [tema, superficie, texto, falha] of [
    ['light', 'rgb(255, 255, 255)', 'rgb(32, 42, 53)', 'rgb(164, 69, 55)'],
    ['dark', 'rgb(28, 36, 45)', 'rgb(230, 235, 239)', 'rgb(237, 176, 167)'],
  ]) {
    await page.locator('html').evaluate((elemento, valor) => { elemento.dataset.theme = valor }, tema)
    await expect(page.locator('#espera [aria-busy=true]')).toBeVisible()
    await expect(page.locator('#espera').getByRole('status')).toContainText('Carregando')
    await expect(page.locator('#espera [data-slot=card]').first()).toHaveCSS('background-color', superficie)
    await expect(page.locator('#espera')).toHaveCSS('color', texto)
    await expect(page.locator('#falha').getByRole('alert')).toHaveCSS('color', falha)
    await expect(page.locator('#falha').getByRole('link', { name: 'Tentar novamente' })).toHaveAttribute('href', '/gestao')
    await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/gestao-fallbacks-${tema}.png`, fullPage: true })
  }
})
