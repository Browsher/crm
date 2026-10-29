import { expect, test } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness } from './dados-grupos'

test.beforeAll(async () => {
  const banco = bancoGruposDoHarness()
  if (!(await banco.sql('SELECT id FROM usuario WHERE email=$1', ['visualgestore2e@teste.local'])).length) {
    await criarUsuarioComSenha(banco, 'vendedor', 'visualgestore2e', 'Senha-e2e-2026')
  }
})

test('gestor administra usuário em diálogos, combina filtros e mantém foco após desativar', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/gestao')
  await page.goto('/usuarios')
  const minhaConta = page.getByRole('row').filter({ has: page.getByText('gestore2e@teste.local', { exact: true }) })
  const contaSemelhante = page.getByRole('row').filter({ has: page.getByText('visualgestore2e@teste.local', { exact: true }) })
  await expect(contaSemelhante).toHaveCount(1)
  await expect(contaSemelhante.getByRole('button', { name: 'Desativar', exact: true })).toBeVisible()
  await expect(minhaConta).toHaveCount(1)
  await expect(minhaConta.getByRole('button')).toHaveCount(0)
  await expect(page.locator('nav a[aria-current=page]')).toHaveAttribute('href', '/usuarios')
  const dialogo = page.getByRole('dialog')
  const email = 'visualusuarios@teste.local'
  await page.getByRole('button', { name: 'Novo usuário', exact: true }).click()
  await dialogo.getByLabel('Nome', { exact: true }).fill('Pessoa Visual com nome extenso para administração de acessos da equipe comercial')
  await dialogo.getByLabel('E-mail', { exact: true }).fill(email)
  await dialogo.getByRole('button', { name: 'Criar usuário', exact: true }).click()
  await expect(dialogo.getByRole('heading', { name: 'Usuário criado' })).toBeVisible()
  await expect(dialogo.locator('code')).not.toBeEmpty()
  await dialogo.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.locator('code')).toHaveCount(0)
  const busca = page.getByLabel('Buscar usuário')
  await busca.fill(email)
  const linha = page.locator('tbody tr')
  await expect(linha).toHaveCount(1)
  await expect(linha).toContainText('Troca pendente')
  await linha.getByRole('button', { name: 'Tornar gestor' }).click()
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  await expect(linha.getByRole('button', { name: 'Tornar gestor' })).toBeFocused()
  await linha.getByRole('button', { name: 'Tornar gestor' }).click()
  await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(dialogo).toHaveCount(0)
  await expect(linha.getByRole('button', { name: 'Tornar vendedor' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Papel', exact: true }).selectOption('gestor')
  await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('ativos')
  await linha.getByRole('button', { name: 'Desativar', exact: true }).click()
  await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(dialogo).toHaveCount(0)
  await expect(linha).toHaveCount(0)
  await expect(busca).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Nenhum usuário encontrado' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('inativos')
  await expect(linha).toHaveCount(1)
  await linha.getByRole('button', { name: 'Reativar', exact: true }).click()
  await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(linha).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('ativos')
  await linha.getByRole('button', { name: 'Nova senha provisória' }).click()
  await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(dialogo.locator('code')).not.toBeEmpty()
  await dialogo.getByRole('button', { name: 'Concluir' }).click()
  await page.getByRole('button', { name: 'Limpar filtros' }).click()
  await busca.fill(email)
  for (const largura of [1440, 1280, 1100, 820, 600, 390]) {
    await page.setViewportSize({ width: largura, height: 900 })
    for (const tema of ['light', 'dark']) {
      await page.getByLabel('Tema de Usuários').selectOption(tema)
      await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const filtros = page.getByRole('region', { name: 'Filtros de usuários', exact: true })
      const card = filtros.locator('[data-slot=card]')
      await expect(card).toHaveCSS('border-radius', '10px')
      await expect(card).toHaveCSS('padding-top', largura <= 820 ? '20px' : '24px')
      const controles = await filtros.locator('input, select, button').evaluateAll(elementos => elementos.map(e => {
        const b = e.getBoundingClientRect()
        return { x: b.x, y: b.y, right: b.right, bottom: b.bottom }
      }))
      const limites = (await card.boundingBox())!
      for (const [i, atual] of controles.entries()) {
        expect(atual.x).toBeGreaterThanOrEqual(limites.x + 19)
        expect(atual.right).toBeLessThanOrEqual(limites.x + limites.width - 19)
        for (const outro of controles.slice(i + 1)) expect(atual.right <= outro.x || outro.right <= atual.x || atual.bottom <= outro.y || outro.bottom <= atual.y).toBe(true)
      }
      const celulaAcoes = page.locator('tbody tr').first().locator('td').last()
      const caixaAcoes = (await celulaAcoes.boundingBox())!
      for (const botao of await celulaAcoes.getByRole('button').all()) {
        const caixaBotao = (await botao.boundingBox())!
        expect(caixaBotao.x + caixaBotao.width).toBeLessThanOrEqual(caixaAcoes.x + caixaAcoes.width)
      }
      await expect(page.locator('tbody tr').first()).toHaveCSS('display', largura <= 600 ? 'grid' : 'table-row')
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-8-captures/usuarios-${largura}-${tema}.png`, fullPage: true, animations: 'disabled' })
      await page.getByRole('button', { name: 'Novo usuário', exact: true }).click()
      await expect(dialogo).toBeVisible()
      await expect(page.locator('.ui-dialog-portal')).toHaveAttribute('data-theme', tema)
      await expect(dialogo).toHaveCSS('background-color', tema === 'dark' ? 'rgb(28, 36, 45)' : 'rgb(255, 255, 255)')
      if (largura <= 820) {
        for (const papel of ['Vendedor', 'Gestor']) {
          const rotulo = dialogo.locator('label').filter({ has: page.getByRole('radio', { name: papel, exact: true }) })
          expect((await rotulo.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        }
      }
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-8-captures/usuarios-dialogo-${largura}-${tema}.png`, animations: 'disabled' })
      await dialogo.getByRole('button', { name: 'Cancelar' }).click()
    }
  }
})

test('perfil do vendedor usa cards e hierarquia de seção do design system', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/gestao')
  await page.goto('/usuarios')
  const linha = page.locator('tbody tr').filter({ hasText: 'redesigne2e@teste.local' })
  await linha.getByRole('link', { name: /Ver perfil/ }).click()
  await expect(page.getByRole('heading', { name: 'Carteira do vendedor', exact: true })).toHaveCSS('font-size', '18px')
  await expect(page.getByRole('region', { name: 'Carteira do vendedor', exact: true })).toHaveCSS('border-radius', '10px')
  for (const largura of [1440, 1280, 1100, 820, 390]) {
    await page.setViewportSize({ width: largura, height: 900 })
    for (const tema of ['light', 'dark']) {
      await page.getByLabel('Tema de Usuários').selectOption(tema)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', largura <= 820 ? '24px' : '28px')
      await expect(page.getByRole('heading', { name: 'Clientes em carteira', exact: true })).toHaveCSS('font-size', '16px')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-8-captures/perfil-${largura}-${tema}.png`, fullPage: true, animations: 'disabled' })
    }
  }
})


test('vendedor continua sem acesso à administração de usuários', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('vendedore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/usuarios')
  await expect(page).toHaveURL('/meu-dia')
  await expect(page.getByRole('button', { name: 'Novo usuário', exact: true })).toHaveCount(0)
})

test('controles e radios conservam alvos de toque em tela larga', async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true })
  const page = await contexto.newPage()
  try {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('gestore2e@teste.local')
    await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
    await expect(page.getByLabel('E-mail')).toHaveCSS('font-size', '16px')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/gestao')
    await page.goto('/usuarios')
    for (const tema of ['light', 'dark']) {
      await page.getByLabel('Tema de Usuários').selectOption(tema)
      await expect(page.getByLabel('Buscar usuário')).toHaveCSS('font-size', '16px')
      await page.getByRole('button', { name: 'Novo usuário', exact: true }).click()
      const dialogo = page.getByRole('dialog')
      await expect(dialogo.getByLabel('Nome', { exact: true })).toHaveCSS('font-size', '16px')
      for (const papel of ['Vendedor', 'Gestor']) {
        const radio = dialogo.getByRole('radio', { name: papel, exact: true })
        expect((await radio.locator('..').boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
      const vendedor = dialogo.getByRole('radio', { name: 'Vendedor', exact: true })
      await vendedor.focus()
      await page.keyboard.press('ArrowRight')
      await expect(dialogo.getByRole('radio', { name: 'Gestor', exact: true })).toBeChecked()
      await expect(dialogo.getByRole('radio', { name: 'Gestor', exact: true })).toBeFocused()
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-8-captures/toque-1280-${tema}.png`, animations: 'disabled' })
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Novo usuário', exact: true })).toBeFocused()
    }
  } finally { await contexto.close() }
})
