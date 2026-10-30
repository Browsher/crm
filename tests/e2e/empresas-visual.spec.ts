import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Client } from 'pg'
import { validarCnpj } from '../../src/features/empresas/cnpj'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

const CNPJ_NOVA = '04252011000110'
const CNPJ_EXISTENTE = '11444777000161'
const NOME_EXISTENTE = 'Empresa Já Cadastrada E2E Empresas Visual'

async function comBancoTemporario<T>(trabalho: (cliente: Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('DATABASE_URL_ADMIN ausente: execute pelo harness E2E')
  exigirAdminLocal(url)
  if (!/^\/teste_[0-9a-f]{12}$/.test(new URL(url).pathname)) {
    throw new Error('Empresas E2E exige consulta somente ao banco temporário do harness')
  }
  return comAdmin(url, trabalho)
}

async function contarCnpj(cnpj: string): Promise<number> {
  return comBancoTemporario(async (cliente) => {
    const resultado = await cliente.query<{ total: number }>(
      'SELECT count(*)::integer AS total FROM empresa WHERE cnpj = $1',
      [cnpj],
    )
    return resultado.rows[0].total
  })
}

async function entrar(page: Page, apelido: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(apelido.includes('gestor') ? '/gestao' : '/meu-dia')
}

async function tabAte(page: Page, alvo: Locator, maximo = 20) {
  for (let i = 0; i < maximo; i++) {
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(alvo).toBeFocused()
}

async function capturarEmTamanhos(page: Page, tela: string) {
  for (const tema of ['light', 'dark'] as const) {
    await page.getByRole('combobox', { name: 'Tema de Empresas' }).selectOption(tema)
    await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
    for (const width of [390, 820, 1100, 1200, 1280, 1920]) {
      await page.setViewportSize({ width, height: 844 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await expect(page.getByRole('main')).toHaveCSS('padding-left', width <= 820 ? '16px' : '32px')
      const card = page.getByRole('main').locator('form [data-slot=card]').first()
      await expect(card).toHaveCSS('border-radius', '10px')
      await expect(card).toHaveCSS('padding-top', width <= 820 ? '20px' : '24px')
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: `.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-8-captures/empresas-${tela}-${tema}-${width}.png`,
        animations: 'disabled',
        fullPage: tela !== 'lista',
      })
    }
  }
}

test.beforeAll(async () => {
  expect(validarCnpj(CNPJ_NOVA)).toBe(true)
  expect(validarCnpj(CNPJ_EXISTENTE)).toBe(true)

  await comBancoTemporario((cliente) => cliente.query(
    `INSERT INTO empresa (cnpj, razao_social, nome_fantasia, contato_nome, telefone, email, cnae_principal)
     VALUES ($1, $2, 'Já cadastrada E2E', 'Bia', '11987654322', 'cadastrada-visual@teste.local', '4742300')
     ON CONFLICT (cnpj) DO NOTHING`,
    [CNPJ_EXISTENTE, NOME_EXISTENTE],
  ))
  expect(await contarCnpj(CNPJ_EXISTENTE)).toBe(1)
})

test('gestor consulta cards com filtros e navegação sem importação manual', async ({ page }) => {
  test.setTimeout(60_000)
  expect(await contarCnpj(CNPJ_NOVA)).toBe(0)
  await entrar(page, 'gestore2e')
  await page.goto('/empresas')
  await expect(page.getByRole('heading', { name: 'Empresas', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name:'Empresas cadastradas' })).toBeVisible()

  await page.getByLabel('Buscar empresas', { exact: true }).fill(NOME_EXISTENTE)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('region', { name:'Empresas cadastradas' })).toContainText('Já cadastrada E2E')
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).click()
  await expect(page).toHaveURL('/empresas')
  await expect(page.getByLabel('Buscar empresas', { exact: true })).toHaveValue('')

  await page.setViewportSize({ width: 390, height: 844 })
  const regiaoTabela = page.getByRole('region', { name: 'Empresas cadastradas' })
  const rolagem = await regiaoTabela.evaluate((elemento) => ({
    conteudo: elemento.scrollWidth,
    visivel: elemento.clientWidth,
    pagina: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(rolagem.conteudo).toBeLessThanOrEqual(rolagem.visivel)
  expect(rolagem.pagina).toBeLessThanOrEqual(rolagem.viewport)
  await page.getByLabel('Buscar empresas', { exact: true }).focus()
  await tabAte(page, regiaoTabela.getByRole('button',{name:/Ver empresa:/}).first())
  await capturarEmTamanhos(page, 'lista')

  await expect(page.getByRole('link', { name: /Importar/ })).toHaveCount(0)
  await page.goto('/empresas/importar')
  await expect(page).toHaveURL('/empresas')
  await expect(page.locator('input[type=file]')).toHaveCount(0)
  expect(await contarCnpj(CNPJ_NOVA)).toBe(0)
})

test('vendedor não acessa Empresas nem importação por URL', async ({ page }) => {
  await entrar(page, 'vendedore2e')
  await expect(page.getByRole('link', { name: 'Empresas', exact: true })).toHaveCount(0)
  await page.goto('/empresas')
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/empresas/importar')
  await expect(page).toHaveURL('/meu-dia')
})

test('cards gerenciais e galeria permanecem legíveis com nome longo e campos ausentes', async ({page}) => {
  const nome='Task8Visual Empresa de Serviços e Comércio de Iluminação com Nome Completo Muito Longo para Conferência do Cadastro'
  await comBancoTemporario(cliente=>cliente.query("INSERT INTO empresa(razao_social,telefone) VALUES($1,'11955554444'),('Task8Visual Sem dados opcionais','11955553333')",[nome]))
  await entrar(page,'gestore2e')
  await page.goto('/empresas?q=Task8Visual')
  const empresas=page.getByRole('region',{name:'Empresas cadastradas'})
  await expect(empresas.getByRole('heading',{name:nome,exact:true})).toBeVisible()
  await expect(empresas).toContainText('Não informado')
  await expect(empresas).toContainText('Sem responsável')
  await expect(empresas.getByRole('button',{name:/Iniciar|Retomar|Continuar atendimento/})).toHaveCount(0)
  for(const width of [390,820,1280]) {
    await page.setViewportSize({width,height:900})
    for(const tema of ['light','dark']) {
      await page.getByRole('combobox',{name:'Tema de Empresas'}).selectOption(tema)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      for(const card of await empresas.locator('[data-slot="card"]').all()) {
        const limites=await card.locator(':scope > *').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}))
        for(let i=1;i<limites.length;i++)expect(limites[i].top).toBeGreaterThanOrEqual(limites[i-1].bottom-1)
      }
      await empresas.screenshot({path:'.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-8-captures/gestor-longo-'+width+'-'+tema+'.png',style:'header[class*="topbar"], a[href="#conteudo-fila"] { visibility:hidden; }'})
    }
  }
  await page.goto('/design')
  await expect(page.locator('[data-etapa-funil]')).toHaveCount(3)
  await expect(page.locator('[data-descarte]')).toHaveCount(1)
  await expect(page.locator('[data-etapa-funil] [data-descarte]')).toHaveCount(0)
  await expect(page.getByText('Reserva expirada',{exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Simular arquivamento',exact:true}).click()
  await expect(page.locator('[data-descarte]')).toHaveAttribute('data-estado','sucesso')
  for(const width of [390,820,1280]) {
    await page.setViewportSize({width,height:900})
    for(const tema of ['light','dark']) {
      await page.getByRole('combobox',{name:'Tema do design system'}).selectOption(tema)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      for(const secao of ['empresas','funil'])await page.locator('#'+secao).screenshot({path:'.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-8-captures/galeria-'+secao+'-'+width+'-'+tema+'.png',style:'header[class*="topbar"], a[href="#conteudo-fila"] { visibility:hidden; }'})
    }
  }
})
