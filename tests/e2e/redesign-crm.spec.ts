import { expect, test, type Page } from '@playwright/test'
import { NOME_REDESIGN } from './dados-redesign'

async function entrar(page: Page, apelido: string, destino: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(destino)
}

async function navegar(page: Page, nome: string) {
  const abrir = page.getByRole('button', { name: 'Menu do CRM', exact: true })
  if (await abrir.isVisible()) {
    await abrir.click()
    const fechar = page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true })
    const alvo = (await fechar.boundingBox())!
    expect(alvo.height).toBeGreaterThanOrEqual(44)
    expect(alvo.width).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('navigation', { name: 'Navegação do CRM', exact: true }).getByRole('link', { name: nome, exact: true }).click()
}

async function capturar(page: Page, nome: string) {
  await expect.poll(() => page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth))).toBe(0)
  await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-4-captures/redesign-${nome}.png`, fullPage: true, animations: 'disabled' })
}

test('galeria compartilha shell e tema sem perder rascunho no atendimento: jornada do vendedor', async ({ page }) => {
  test.setTimeout(90_000)
  await entrar(page, 'redesigne2e', '/meu-dia')
  await page.getByTestId('lista-meu-dia').getByRole('button').filter({ hasText: NOME_REDESIGN }).click()
  for (const largura of [1440, 1280, 820, 390]) {
    await page.setViewportSize({ width: largura, height: 900 })
    for (const tema of ['light', 'dark']) {
      await page.getByLabel('Tema do Meu dia').selectOption(tema)
      await capturar(page, `agenda-${largura}-${tema}`)
    }
  }
  await page.getByRole('button', { name: 'Voltar para retornos' }).click()
  const selecionada = page.getByTestId('lista-meu-dia').getByRole('button').filter({ hasText: NOME_REDESIGN })
  await expect(selecionada).toBeFocused()
  await selecionada.click()
  await page.getByRole('link', { name: 'Abrir atendimento', exact: true }).click()
  await expect(page.getByLabel('Tema da Carteira')).toHaveValue('dark')
  await page.getByRole('button', { name: 'Registrar atendimento', exact: true }).click()
  await page.getByLabel('Nota', { exact: true }).fill('Rascunho preservado entre abas')
  await page.getByRole('tab', { name: 'Histórico', exact: true }).click()
  await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Rascunho preservado entre abas')
  await capturar(page, 'atendimento-mobile-dark')
  await page.getByRole('button', { name: 'Cancelar atendimento', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Rascunho preservado entre abas')
  await page.getByRole('button', { name: 'Cancelar atendimento', exact: true }).click()
  await page.getByRole('button', { name: 'Descartar e continuar', exact: true }).click()
  await expect(page.getByLabel('Nota', { exact: true })).toHaveCount(0)
  await navegar(page, 'Funil')
  await expect(page.getByLabel('Tema do Funil')).toHaveValue('dark')
  const negociacao = page.getByRole('button', { name: /Redesign Negociação/ })
  await negociacao.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(negociacao).toBeFocused()
  await navegar(page, 'Carteira')
  await page.getByLabel('Nome', { exact: true }).fill('Redesign Cliente')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page).toHaveURL(/nome=Redesign\+Cliente/)
  await expect(page.getByLabel('Tema da Carteira')).toHaveValue('dark')
  const filtros = new URL(page.url()).search
  await page.getByRole('link', { name: 'Ver cliente', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NOME_REDESIGN)
  await page.getByRole('link', { name: /Voltar.*carteira/i }).click()
  expect(new URL(page.url()).searchParams.get('nome')).toBe(new URLSearchParams(filtros).get('nome'))
  await navegar(page, 'Prospecção')
  await expect(page.getByRole('heading', { name: 'Prospecção', exact: true })).toBeVisible()
  await capturar(page, 'prospeccao-mobile-dark')
  await page.getByRole('button', { name: 'Menu do CRM' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL('/login')
})

test('jornada do gestor mantém navegação, grupos ativos e portal escuro', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrar(page, 'gestore2e', '/gestao')
  await page.getByLabel('Tema da Gestão').selectOption('dark')
  await capturar(page, 'gestao-desktop-dark')
  await navegar(page, 'Empresas')
  await expect(page.getByLabel('Tema de Empresas')).toHaveValue('dark')
  await capturar(page, 'empresas-desktop-dark')
  await navegar(page, 'Listas')
  const nav = page.getByRole('navigation', { name: 'Navegação do CRM' })
  await expect(nav.locator('[aria-current=page]')).toHaveCount(1)
  await expect(nav.locator('[aria-current=page]')).toHaveAttribute('href', '/empresas/grupos')
  await capturar(page, 'grupos-desktop-dark')
  await navegar(page, 'Usuários')
  const abrir = page.getByRole('button', { name: 'Novo usuário', exact: true })
  await abrir.click()
  await expect(page.locator('.ui-dialog-portal')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Escape')
  await expect(abrir).toBeFocused()
  await capturar(page, 'usuarios-desktop-dark')
  await navegar(page, 'Design system')
  await expect(page.getByLabel('Tema do design system')).toHaveValue('dark')
  await expect(page.getByRole('navigation', { name: 'Navegação do CRM' }).locator('[aria-current=page]')).toHaveAttribute('href', '/design')
  await expect(page.getByRole('table', { name: 'Empresas de demonstração' })).toBeVisible()
  await capturar(page, 'galeria-desktop-dark')
  await navegar(page, 'Usuários')
  await expect(page.getByLabel('Tema de Usuários')).toHaveValue('dark')
  await expect(page.getByRole('button', { name: 'Novo usuário', exact: true })).toHaveCSS('min-height', '40px')
  await navegar(page, 'WhatsApp')
  await expect(page.getByLabel('Tema do WhatsApp')).toHaveValue('dark')
  await page.getByRole('link', { name: 'Configurar vendedores' }).click()
  await expect(page.getByRole('heading', { name: 'Configurar vendedores' })).toBeVisible()
  await capturar(page, 'whatsapp-configuracao-desktop-dark')
})

test('acesso e senha provisória seguem o tema do dispositivo em 390px', async ({ page }) => {
  test.setTimeout(90_000)
  const capturarAcesso = async (nome: string) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-8-captures/${nome}.png`, fullPage: true, animations: 'disabled' })
  }
  for (const largura of [1440, 1280, 1100, 820, 390]) {
    await page.setViewportSize({ width: largura, height: 900 })
    for (const tema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: tema })
      await page.goto('/login')
      await expect(page.locator('main.crm-ui')).toHaveCSS('background-color', tema === 'dark' ? 'rgb(28, 36, 45)' : 'rgb(255, 255, 255)')
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', largura <= 820 ? '24px' : '28px')
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('line-height', largura <= 820 ? '32px' : '36px')
      await expect(page.getByText('CRM · Gestão comercial', { exact: true })).toHaveCSS('line-height', '18px')
      await expect(page.getByLabel('E-mail')).toHaveAttribute('autocomplete', 'username')
      await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
      await page.getByLabel('E-mail').focus()
      await expect(page.getByLabel('E-mail')).toHaveCSS('outline-width', '3px')
      await expect(page.getByLabel('E-mail')).toHaveCSS('outline-offset', '3px')
      await expect(page.getByLabel('E-mail')).toHaveCSS('font-size', largura <= 820 ? '16px' : '14px')
      await capturarAcesso(`login-${largura}-${tema}`)
    }
  }
  await page.getByLabel('E-mail').fill('naoexiste-tarefa8@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.locator('main').getByRole('alert')).toContainText('não conferem')
  await expect(page.locator('main').getByRole('alert')).toHaveCSS('background-color', 'rgb(68, 44, 42)')
  await expect(page.getByLabel('E-mail')).toHaveValue('naoexiste-tarefa8@teste.local')
  await capturarAcesso('login-erro-390-dark')
  await entrar(page, 'redesignprovisorioe2e', '/trocar-senha')
  await expect(page.getByText('Sua senha é provisória.', { exact: false })).toBeVisible()
  for (const largura of [1280, 820, 390]) {
    await page.setViewportSize({ width: largura, height: 900 })
    for (const tema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: tema })
      await expect(page.locator('main').getByRole('alert')).toHaveCSS('background-color', tema === 'dark' ? 'rgb(24, 32, 41)' : 'rgb(250, 251, 252)')
      await expect(page.getByLabel('Nova senha')).toHaveAttribute('autocomplete', 'new-password')
      await capturarAcesso(`trocar-senha-${largura}-${tema}`)
    }
  }
})

for (const [rota, tema] of [['/carteira', 'Tema da Carteira'], ['/meu-dia', 'Tema do Meu dia']]) {
  test(`filtro em ${rota} preserva o tema escolhido`, async ({ page }) => {
    await entrar(page, 'redesigne2e', '/meu-dia')
    await page.goto(rota)
    await page.getByLabel(tema).selectOption('dark')
    await page.getByLabel('Nome', { exact: true }).fill('Redesign')
    await page.getByLabel('Retorno', { exact: true }).selectOption('hoje')
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
    await expect(page).toHaveURL(/nome=Redesign/)
    await expect(page.getByLabel(tema)).toHaveValue('dark')
    const filtros = page.locator('form').filter({ has: page.getByRole('searchbox', { name: 'Nome', exact: true }) })
    await expect(filtros).toHaveCount(1)
    await filtros.getByRole('link', { name: 'Limpar filtros', exact: true }).click()
    await expect(page).toHaveURL(rota)
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Retorno', { exact: true })).toHaveValue('')
    await page.goBack()
    await expect(page).toHaveURL(/nome=Redesign/)
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Redesign')
    await expect(page.getByLabel('Retorno', { exact: true })).toHaveValue('hoje')
    await expect(page.getByLabel(tema)).toHaveValue('dark')
    await page.goForward()
    await expect(page).toHaveURL(rota)
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('')
  })
}

test('filtrar Meu dia seleciona uma empresa dos novos resultados', async ({ page }) => {
  await entrar(page, 'redesigne2e', '/meu-dia')
  await page.getByTestId('lista-meu-dia').getByRole('button').filter({ hasText: 'Redesign Negociação' }).click()
  await page.getByLabel('Nome', { exact: true }).fill('Redesign Cliente')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page).toHaveURL(/nome=Redesign\+Cliente/)
  await expect(page.getByRole('article').getByRole('heading', { name: NOME_REDESIGN, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir atendimento', exact: true })).toBeVisible()
})

test('filtros móveis têm alvos de toque de 44px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await entrar(page, 'redesigne2e', '/meu-dia')
  await page.goto('/carteira')
  for (const nome of ['UF', 'Retorno']) {
    const alvo = (await page.getByLabel(nome, { exact: true }).boundingBox())!
    expect(alvo.height).toBeGreaterThanOrEqual(44)
  }
})

test('botão destrutivo mantém contraste de texto nos dois temas e hover', async ({ page }) => {
  await entrar(page, 'gestore2e', '/gestao')
  await page.goto('/design')
  const excluir = page.getByRole('button', { name: 'Excluir exemplo', exact: true })
  async function contraste() {
    return excluir.evaluate(elemento => {
      const tela = document.createElement('canvas')
      tela.width = tela.height = 1
      const contexto = tela.getContext('2d')!
      contexto.fillStyle = '#fff'
      contexto.fillRect(0, 0, 1, 1)
      const ancestrais: Element[] = []
      for (let atual: Element | null = elemento; atual; atual = atual.parentElement) ancestrais.unshift(atual)
      for (const atual of ancestrais) {
        contexto.fillStyle = getComputedStyle(atual).backgroundColor
        contexto.fillRect(0, 0, 1, 1)
      }
      const fundo = contexto.getImageData(0, 0, 1, 1).data.slice(0, 3)
      contexto.clearRect(0, 0, 1, 1)
      contexto.fillStyle = getComputedStyle(elemento).color
      contexto.fillRect(0, 0, 1, 1)
      const texto = contexto.getImageData(0, 0, 1, 1).data.slice(0, 3)
      const luminancia = (cor: Uint8ClampedArray) => [...cor].map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((soma, v, i) => soma + v * [0.2126, 0.7152, 0.0722][i], 0)
      const a = luminancia(fundo), b = luminancia(texto)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    })
  }
  for (const tema of ['light', 'dark']) {
    await page.mouse.move(0, 0)
    await page.getByLabel('Tema do design system').selectOption(tema)
    await expect.poll(contraste).toBeGreaterThanOrEqual(4.5)
    await excluir.hover()
    await expect.poll(contraste).toBeGreaterThanOrEqual(4.5)
  }
})


test('tarefa 9: atendimento conserva rascunho, campos e geometria nos dois temas', async ({ page }) => {
  test.setTimeout(120_000)
  await entrar(page, 'redesigne2e', '/meu-dia')
  await expect(page.getByLabel('Nome', { exact: true }).locator('xpath=ancestor::form')).toContainText('Filtrar')
  const filtros = page.getByLabel('Nome', { exact: true }).locator('xpath=ancestor::*[@data-slot="card"]')
  await expect(filtros).toHaveCSS('border-radius', '10px')
  await page.getByTestId('lista-meu-dia').getByRole('button').filter({ hasText: NOME_REDESIGN }).click()
  await expect(page.getByRole('article')).toHaveCSS('border-radius', '10px')
  await page.getByRole('link', { name: 'Abrir atendimento', exact: true }).click()
  await page.getByRole('button', { name: 'Registrar atendimento', exact: true }).click()
  const nota = page.getByLabel('Nota', { exact: true })
  const longa = 'Rascunho que deve sobreviver ' + 'anotação longa sem perda '.repeat(45)
  await nota.fill(longa)
  await page.getByRole('tab', { name: 'Histórico', exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar atendimento', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(nota).toHaveValue(longa)
  await expect(page.getByRole('button', { name: 'Cancelar atendimento', exact: true })).toBeFocused()
  const editor = page.getByRole('region', { name: 'Registrar atendimento', exact: true })
  for (const width of [1920, 1280, 1100, 1000, 820, 600, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const tema of ['light', 'dark']) {
      await page.getByLabel('Tema da Carteira').selectOption(tema)
      await expect(editor).toHaveCSS('border-radius', '10px')
      await expect(editor).toHaveCSS('padding', width <= 820 ? '20px' : '24px')
      await expect(editor.getByRole('heading', { name: 'Registrar atendimento' })).toHaveCSS('font-size', '18px')
      await expect(editor.getByRole('heading', { name: 'Registrar atendimento' })).toHaveCSS('line-height', '26px')
      await expect(nota).toHaveCSS('border-radius', '6px')
      await expect(nota).toHaveCSS('min-height', '96px')
      await expect(nota).toHaveCSS('font-size', width <= 820 ? '16px' : '14px')
      for (const campo of await editor.locator('input:not([type=hidden]):not([type=radio]), textarea, button').all()) {
        const box = (await campo.boundingBox())!
        const pai = (await editor.boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(pai.x)
        expect(box.x + box.width).toBeLessThanOrEqual(pai.x + pai.width + 1)
        expect(box.height).toBeGreaterThanOrEqual(width <= 820 ? 44 : 40)
      }
      const titulo = (await editor.getByRole('heading').boundingBox())!
      const cancelar = (await editor.getByRole('button', { name: 'Cancelar atendimento' }).boundingBox())!
      expect(titulo.x + titulo.width <= cancelar.x || titulo.y + titulo.height <= cancelar.y).toBe(true)
      const cabecalho = page.getByRole('article').locator(':scope > header')
      const caixaCabecalho = (await cabecalho.boundingBox())!
      for (const grupo of await cabecalho.locator(':scope > div').all()) {
        const caixaGrupo = (await grupo.boundingBox())!
        expect(caixaGrupo.x + caixaGrupo.width).toBeLessThanOrEqual(caixaCabecalho.x + caixaCabecalho.width + 1)
      }
      await expect.poll(() => page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), { message: `Transbordamento na ficha: ${width}px, ${tema}` }).toBe(0)
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-9-captures/atendimento-${width}-${tema}.png`, fullPage: true, animations: 'disabled' })
    }
  }
  await expect(nota).toHaveValue(longa)
})


test('tarefa 9: toque em 1280px mantém campos e avanço por botão', async ({ browser }) => {
  const contexto = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 1000 } })
  const page = await contexto.newPage()
  try {
    await entrar(page, 'redesigne2e', '/meu-dia')
    await expect(page.getByLabel('Nome', { exact: true })).toHaveCSS('font-size', '16px')
    await page.getByTestId('lista-meu-dia').getByRole('button').filter({ hasText: NOME_REDESIGN }).click()
    await page.getByRole('link', { name: 'Abrir atendimento', exact: true }).click()
    const voltar = page.getByRole('navigation', { name: 'Navegação da ficha' }).getByRole('link')
    const caixaVoltar = (await voltar.boundingBox())!
    expect(caixaVoltar.height).toBeGreaterThanOrEqual(44)
    expect(caixaVoltar.width).toBeGreaterThanOrEqual(44)
    await expect(voltar).toHaveAttribute('href', '/meu-dia')
    await page.screenshot({ path: '.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-9-captures/revisao-voltar-toque-1280.png', animations: 'disabled' })
    await page.goto('/funil')
    const empresa = page.locator('[data-slot=card]').filter({ has: page.getByRole('heading', { name: 'Redesign Negociação', exact: true }) })
    const card = empresa.getByRole('button', { name: 'Abrir no funil', exact: true })
    await expect(empresa.locator('xpath=ancestor::*[@draggable]')).toHaveAttribute('draggable', 'false')
    await expect(empresa).toHaveCSS('border-radius', '10px')
    await expect(empresa.getByRole('heading', { name: 'Redesign Negociação', exact: true })).toHaveCSS('font-size', '16px')
    await card.click()
    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('button', { name: /Avançar para/ })).toBeVisible()
    for (const tema of ['light', 'dark']) {
      await page.keyboard.press('Escape')
      await expect(card).toBeFocused()
      await page.getByLabel('Tema do Funil').selectOption(tema)
      await card.click()
      await page.getByRole('button', { name: 'Registrar venda', exact: true }).click()
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await expect(page.getByLabel('Valor em reais')).toHaveCSS('font-size', '16px')
      await expect(page.getByLabel('Valor em reais')).toHaveCSS('min-height', '44px')
      await page.getByLabel('Observação (opcional)').fill('Nota de venda longa '.repeat(60))
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-9-captures/funil-toque-1280-${tema}.png`, animations: 'disabled' })
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Descartar', exact: true }).click()
      await card.click()
    }
    await page.keyboard.press('Escape')
  } finally {
    await contexto.close()
  }
})
