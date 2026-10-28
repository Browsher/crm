import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness } from './dados-grupos'

async function entrar(page: Page, apelido: 'gestore2e' | 'designsystemvazioe2e'): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(apelido === 'gestore2e' ? '/gestao' : '/meu-dia')
}

test.beforeAll(async () => {
  const banco = bancoGruposDoHarness()
  const existente = await banco.sql('SELECT id FROM usuario WHERE email = $1', ['designsystemvazioe2e@teste.local'])
  if (!existente.length) await criarUsuarioComSenha(banco, 'vendedor', 'designsystemvazioe2e', 'Senha-e2e-2026')
})

// A fixture usa os componentes reais e somente o CSS compilado da aplicação.
// Fica fora de .crm-ui para cobrir também as telas de acesso.
let htmlVariantes: string | undefined

async function montarVariantes(page: Page) {
  const html = htmlVariantes ??= execFileSync(process.execPath, ['--import', 'tsx', '--eval', `
    const { createElement: h } = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    const { Button } = require('./src/components/ui/button')
    const { Input } = require('./src/components/ui/input')
    const { Textarea } = require('./src/components/ui/textarea')
    const { NativeSelect } = require('./src/components/ui/native-select')
    const { Card, CardContent, CardTitle } = require('./src/components/ui/card')
    const botoes = ['xs', 'sm', 'default', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg']
      .map(size => h(Button, { key: size, size, 'aria-label': 'Tamanho ' + size }, 'A'))
    process.stdout.write(renderToStaticMarkup(h('section', { id: 'contrato-controles' },
      ...botoes,
      h(Input, { 'aria-label': 'Entrada isolada', readOnly: true, defaultValue: 'Pode copiar' }),
      h(Textarea, { 'aria-label': 'Nota isolada', readOnly: true, defaultValue: 'Nota preservada' }),
      h(Textarea, { 'aria-label': 'Nota longa', rows: 8, defaultValue: 'Oito linhas' }),
      h(NativeSelect, { 'aria-label': 'Seleção isolada' }, h('option', null, 'SP')),
      h(Button, { asChild: true }, h('a', { href: '/fila' }, 'Ir à fila no contrato')),
      h(Card, null, h(CardTitle, null, 'Card do contrato'), h(CardContent, null, 'Conteúdo')),
    )))
  `], { encoding: 'utf8' })
  await page.evaluate(conteudo => {
    const raiz = document.createElement('div')
    raiz.innerHTML = conteudo
    document.body.append(raiz)
  }, html)
}

test('controles mantêm tema e medidas em desktop e toque', async ({ page, browser }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await entrar(page, 'gestore2e')
  await page.goto('/design')
  await montarVariantes(page)
  const telefone = page.getByLabel('Telefone com erro', { exact: true })
  const estado = page.getByLabel('Estado', { exact: true })
  for (const [tema, fundo, secundario, foco] of [
    ['light', 'rgb(255, 255, 255)', 'rgb(250, 251, 252)', 'rgb(23, 99, 77)'],
    ['dark', 'rgb(28, 36, 45)', 'rgb(24, 32, 41)', 'rgb(143, 208, 185)'],
  ]) {
    await page.getByLabel('Tema do design system').selectOption(tema)
    await expect(estado).toHaveCSS('background-color', fundo)
    const cardDaGaleria = page.locator('.crm-ui [data-slot="card"]').first()
    await expect(cardDaGaleria).toHaveCSS('background-color', fundo)
    await expect(cardDaGaleria).toHaveCSS('color', tema === 'dark' ? 'rgb(230, 235, 239)' : 'rgb(32, 42, 53)')
    await expect(telefone).toHaveCSS('min-height', '40px')
    await expect(telefone).toHaveCSS('font-size', '14px')
    await expect(telefone).toHaveCSS('box-shadow', 'none')
    await expect(page.getByLabel('Código da reserva', { exact: true })).toHaveCSS('background-color', secundario)
    await page.getByText('Telefone com erro', { exact: true }).click()
    await expect(telefone).toBeFocused()
    await expect(telefone).toHaveAttribute('aria-describedby', 'telefone-erro')
    await telefone.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(telefone).toHaveCSS('outline-width', '3px')
    await expect(telefone).toHaveCSS('outline-offset', '3px')
    await expect(telefone).toHaveCSS('outline-color', foco)
    await expect(telefone).toHaveCSS('box-shadow', 'none')
    await expect(page.getByRole('button', { name: 'Reservar para ligar', exact: true })).toBeDisabled()
    await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-4-captures/design-system-desktop-${tema}.png`, animations: 'disabled' })
  }
  // O tema global também chega a controles fora do contêiner da galeria.
  await page.getByLabel('Tema do design system').selectOption('light')
  await page.locator('html').evaluate(elemento => elemento.setAttribute('data-theme', 'light'))
  await expect(page.getByLabel('Seleção isolada')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.getByLabel('Entrada isolada')).toHaveCSS('background-color', 'rgb(250, 251, 252)')
  await expect(page.getByLabel('Nota isolada')).toHaveCSS('background-color', 'rgb(250, 251, 252)')
  await expect(page.getByLabel('Nota isolada')).toHaveCSS('min-height', '96px')
  expect((await page.getByLabel('Nota longa').boundingBox())!.height).toBeGreaterThan(160)
  await expect(page.getByRole('link', { name: 'Ir à fila no contrato' })).toHaveAttribute('href', '/fila')
  await expect(page.getByRole('link', { name: 'Ir à fila no contrato' }).locator('button')).toHaveCount(0)
  for (const size of ['xs', 'sm', 'default', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg']) {
    const botao = page.getByRole('button', { name: `Tamanho ${size}`, exact: true })
    const alvo = (await botao.boundingBox())!
    expect(alvo.height).toBeGreaterThanOrEqual(size === 'lg' ? 44 : 40)
    if (size.startsWith('icon')) expect(alvo.width).toBe(alvo.height)
    await expect(botao).toHaveCSS('box-shadow', 'none')
    await expect(botao).toHaveCSS('border-radius', '6px')
  }
  const card = page.locator('#contrato-controles [data-slot="card"]')
  await expect(card).toHaveCSS('border-radius', '10px')
  await expect(card).toHaveCSS('padding-top', '24px')
  await expect(card).toHaveCSS('box-shadow', 'none')
  await expect(page.getByText('Card do contrato', { exact: true })).toHaveCSS('line-height', '24px')

  const toque = await browser.newContext({ baseURL: 'http://localhost:3100', hasTouch: true, viewport: { width: 1280, height: 900 } })
  try {
    const tela = await toque.newPage()
    await entrar(tela, 'gestore2e')
    await tela.goto('/design')
    await montarVariantes(tela)
    for (const nome of ['Telefone com erro', 'Estado', 'Nota isolada']) {
      const campo = tela.getByLabel(nome, { exact: true })
      await expect(campo).toHaveCSS('font-size', '16px')
      expect((await campo.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    for (const size of ['xs', 'sm', 'default', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg']) {
      const alvo = (await tela.getByRole('button', { name: `Tamanho ${size}`, exact: true }).boundingBox())!
      expect(alvo.height).toBeGreaterThanOrEqual(44)
      if (size.startsWith('icon')) expect(alvo.width).toBe(alvo.height)
    }
  } finally {
    await toque.close()
  }
})

test('campos e cards conservam espaço confortável no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await entrar(page, 'gestore2e')
  await page.goto('/design')
  await montarVariantes(page)
  for (const tema of ['light', 'dark']) {
    await page.getByLabel('Tema do design system').selectOption(tema)
    for (const nome of ['Telefone com erro', 'Estado', 'Anotações da tentativa']) {
      const campo = page.getByLabel(nome, { exact: true })
      await expect(campo).toHaveCSS('font-size', '16px')
      expect((await campo.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await expect(page.getByLabel('Anotações da tentativa')).toHaveCSS('min-height', '96px')
    await expect(page.locator('#contrato-controles [data-slot="card"]')).toHaveCSS('padding-top', '20px')
    await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-4-captures/design-system-mobile-${tema}.png`, animations: 'disabled' })
  }
})

test('Carteira realmente vazia orienta primeiro uso em Card e navega pelo CTA com foco', async ({ page }) => {
  await entrar(page, 'designsystemvazioe2e')
  await page.goto('/carteira')
  const titulo = page.getByRole('heading', { name: 'Sua carteira está vazia', exact: true })
  await expect(titulo).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('Nenhum cliente corresponde aos filtros')
  const card = page.locator('[data-slot="card"]').filter({ has: titulo })
  const cta = card.getByRole('link', { name: 'Puxar a próxima empresa', exact: true })
  const referencia = await page.context().newPage()
  await referencia.setContent(readFileSync('docs/design/design-system-padrao.html', 'utf8'))
  const cardReferencia = referencia.locator('[data-component="empty-state"]')
  for (const tema of ['light', 'dark']) {
    await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await expect(card).toHaveCSS('border-top-style', 'solid')
      await expect(card).toHaveCSS('border-top-width', '1px')
      await expect(card).toHaveCSS('border-radius', '10px')
      await expect(card).toHaveCSS('box-shadow', 'none')
      await expect(card).toHaveCSS('background-color', tema === 'light' ? 'rgb(255, 255, 255)' : 'rgb(28, 36, 45)')
      await expect(card).toHaveCSS('padding-top', width === 390 ? '20px' : '24px')
      await referencia.setViewportSize({ width, height: 844 })
      await referencia.locator('html').evaluate((elemento, valor) => elemento.setAttribute('data-theme', valor), tema)
      // A referência aprovada ancora composição, espaçamento e superfície.
      for (const propriedade of ['min-height', 'border-radius', 'border-top-style', 'background-color']) {
        await expect(card).toHaveCSS(propriedade, await cardReferencia.evaluate((elemento, chave) => getComputedStyle(elemento).getPropertyValue(chave), propriedade))
      }
      await cardReferencia.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-4-captures/task-2-captures/referencia-vazia-${tema}-${width}.png`, animations: 'disabled' })
      await expect(titulo).toHaveCSS('font-size', '16px')
      await expect(titulo).toHaveCSS('line-height', '24px')
      await expect(card.locator('[data-slot="card-description"]')).toHaveCSS('font-size', '14px')
      await expect(card.locator('[data-slot="card-description"]')).toHaveCSS('line-height', '21px')
      await expect(card.locator('[data-slot="card-footer"] a')).toHaveAttribute('href', '/fila')
      await expect(cta).toHaveAttribute('data-slot', 'button')
      await expect(cta).toHaveAttribute('data-variant', 'default')
      await expect(card.locator('a button, button a')).toHaveCount(0)
      await cta.focus()
      await cta.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(cta).toBeFocused()
      await expect(cta).toHaveCSS('outline-width', '3px')
      await expect(cta).toHaveCSS('outline-offset', '3px')
      expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(width === 390 ? 44 : 40)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-4-captures/task-2-captures/carteira-vazia-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })
    }
  }
  await referencia.close()
  await cta.press('Enter')
  await expect(page).toHaveURL('/fila')
})

test('filtro sem resultado oferece recuperação no Card e conserva rota da ficha', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('carteiravisuale2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/carteira?nome=NenhumResultadoSintetico&uf=SP&retorno=atrasado')
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('NenhumResultadoSintetico')
  await expect(page.getByLabel('UF', { exact: true })).toHaveValue('SP')
  await expect(page.getByLabel('Retorno', { exact: true })).toHaveValue('atrasado')
  const titulo = page.getByRole('heading', { name: 'Nenhum cliente corresponde aos filtros', exact: true, level: 3 })
  const card = page.locator('[data-slot="card"]').filter({ has: titulo })
  const cta = card.getByRole('link', { name: 'Limpar filtros', exact: true })
  await expect(page.getByRole('main')).not.toContainText('Sua carteira está vazia')
  for (const tema of ['light', 'dark']) {
    await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await expect(card).toHaveCSS('border-top-style', 'solid')
      await expect(card).toHaveCSS('border-radius', '10px')
      await expect(cta).toHaveAttribute('data-variant', 'outline')
      await expect(card.locator('[data-slot="card-footer"] a')).toHaveAttribute('href', '/carteira')
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-4-captures/task-2-captures/carteira-filtro-sem-resultado-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })
    }
  }
  await cta.click()
  await expect(page).toHaveURL('/carteira')
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('')
  await expect(page.getByRole('link', { name: 'Ver cliente', exact: true })).toHaveCount(2)
  await page.getByRole('link', { name: 'Ver cliente', exact: true }).first().click()
  await expect(page).toHaveURL(/\/carteira\/[0-9a-f-]+$/)
})


test('Carteira usa painel em Card, registros a 600px e aviso semântico de filtros inválidos', async ({ page }) => {
  await entrar(page, 'designsystemvazioe2e')
  await page.goto('/carteira?uf=INVALIDA')
  const aviso = page.getByRole('main').getByRole('alert')
  await expect(aviso).toHaveAttribute('data-slot', 'alert')
  await expect(aviso.getByRole('heading', { name: 'Filtros inválidos', exact: true })).toBeVisible()
  await expect(aviso).toContainText('Os filtros informados não puderam ser aplicados.')
  await expect(page.getByText('Sua carteira está vazia', { exact: true })).toHaveCount(0)
  await aviso.getByRole('link', { name: 'Limpar filtros', exact: true }).click()
  const painel = page.locator('form [data-slot="card"]')
  await expect(page.locator('form')).toHaveCount(1)
  await expect(painel.getByRole('button', { name: 'Filtrar', exact: true })).toBeVisible()
  await expect(painel).toHaveCSS('border-radius', '10px')
  await expect(painel).toHaveCSS('padding-top', '24px')
})


test('registros da Carteira preservam leitura, ações e medidas da referência em cada quebra', async ({ page }) => {
  test.setTimeout(90_000)
  const banco = bancoGruposDoHarness()
  const nomeLongo = 'EmpresaSinteticaComNomeMuitoLongoSemEspacos'.repeat(5)
  await banco.sql('UPDATE empresa SET razao_social = $1 WHERE id = $2', [nomeLongo, '00000000-0000-4000-8000-000000000302'])
  const referencia = await page.context().newPage()
  await referencia.setContent(readFileSync('docs/design/design-system-padrao.html', 'utf8'))
  try {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('carteiravisuale2e@teste.local')
    await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/meu-dia')
    await page.goto('/carteira')
    const tabela = page.getByRole('table', { name: 'Clientes da sua carteira' })
    const linha = page.getByRole('row').filter({ has: page.getByRole('heading', { name: nomeLongo, exact: true }) })
    await expect(tabela.getByRole('columnheader')).toHaveCount(6)
    for (const tema of ['light', 'dark']) {
      await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
      await referencia.locator('html').evaluate((elemento, valor) => elemento.setAttribute('data-theme', valor), tema)
      for (const width of [600, 601, 760, 820, 1920, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        await referencia.setViewportSize({ width, height: 1000 })
        const tituloSecao = page.getByRole('heading', { name: 'Clientes', exact: true, level: 2 })
        await expect(tituloSecao).toHaveCSS('font-size', '18px')
        await expect(tituloSecao).toHaveCSS('line-height', '26px')
        await expect(tituloSecao).toHaveCSS('font-weight', '600')
        await expect(tabela).toHaveCSS('display', width <= 600 ? 'block' : 'table')
        await expect(linha).toHaveCSS('display', width <= 600 ? 'grid' : 'table-row')
        if (width > 600) await expect(linha.getByRole('cell').first()).toHaveCSS('padding-top', '16px')
        if (width <= 600) {
          expect(await linha.getByRole('cell').nth(1).evaluate(elemento => getComputedStyle(elemento, '::before').content)).toBe('"Contato principal"')
          expect(await linha.getByRole('cell').last().evaluate(elemento => getComputedStyle(elemento, '::before').content)).toBe('"Ações"')
        }
        await expect(linha).toContainText('Contato principal não informado')
        const badge = linha.locator('[data-slot="badge"]')
        const badgeReferencia = referencia.locator('.badge-success').first()
        // A tipografia e o raio vêm da referência aprovada; células seguem os 16px do inventário.
        for (const propriedade of ['font-size', 'line-height', 'border-radius']) {
          await expect(badge).toHaveCSS(propriedade, await badgeReferencia.evaluate((elemento, chave) => getComputedStyle(elemento).getPropertyValue(chave), propriedade))
        }
        const acao = linha.getByRole('link', { name: 'Ver cliente', exact: true })
        await acao.focus()
        await acao.press('Tab')
        await page.keyboard.press('Shift+Tab')
        await expect(acao).toBeFocused()
        await expect(acao).toHaveCSS('outline-width', '3px')
        await expect(acao).toBeInViewport()
        expect((await acao.boundingBox())!.height).toBe(width <= 820 ? 44 : 40)
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
        const painel = page.locator('form [data-slot="card"]')
        await expect(painel).toHaveCSS('padding-top', await referencia.locator('.table-toolbar').evaluate(elemento => getComputedStyle(elemento).paddingTop))
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
        await referencia.locator('#tabelas').screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-3-captures/referencia-${tema}-${width}.png`, animations: 'disabled' })
        await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-3-captures/registros-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
  } finally {
    await referencia.close()
    await banco.sql('UPDATE empresa SET razao_social = $1 WHERE id = $2', ['Carteira Visual Boreal', '00000000-0000-4000-8000-000000000302'])
  }
})
