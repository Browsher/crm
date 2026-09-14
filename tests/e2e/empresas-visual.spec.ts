import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import type { Client } from 'pg'
import { validarCnpj } from '../../src/features/empresas/cnpj'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

const CABECALHO = 'cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal'
const CNPJ_NOVA = '04252011000110'
const CNPJ_EXISTENTE = '11444777000161'
const CNPJ_TROCA = '12ABC34501DE35'
const CNPJ_RECUSADO = '04252011000111'
const NOME_NOVA = 'Empresa Importada E2E Empresas Visual'
const NOME_EXISTENTE = 'Empresa Já Cadastrada E2E Empresas Visual'

const CSV_MISTO = [
  CABECALHO,
  `${CNPJ_NOVA},${NOME_NOVA},Importada E2E,Ana,11987654321,importada-visual@teste.local,01001000,4742300`,
  `${CNPJ_EXISTENTE},${NOME_EXISTENTE},Já cadastrada E2E,Bia,11987654322,cadastrada-visual@teste.local,,4742300`,
  `${CNPJ_RECUSADO},Empresa Recusada E2E,,Caio,11987654323,recusada-visual@teste.local,01001000,4742300`,
].join('\n')

const CSV_TROCA = [
  CABECALHO,
  `${CNPJ_TROCA},Empresa Troca E2E Empresas Visual,,Dani,11987654324,troca-visual@teste.local,,4742300`,
].join('\n')

const CSV_ZERO_NOVAS = [
  CABECALHO,
  `${CNPJ_EXISTENTE},${NOME_EXISTENTE},Já cadastrada E2E,Bia,11987654322,cadastrada-visual@teste.local,,4742300`,
].join('\n')

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
  await expect(page).toHaveURL('/meu-dia')
}

function valorDoResumo(page: Page, rotulo: string): Locator {
  return page.locator('dt').filter({ hasText: rotulo }).locator('xpath=following-sibling::dd')
}

async function tabAte(page: Page, alvo: Locator, maximo = 20) {
  for (let i = 0; i < maximo; i++) {
    if (await alvo.evaluate((elemento) => elemento === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(alvo).toBeFocused()
}

async function capturarEmTamanhos(page: Page, tela: string, testInfo: TestInfo) {
  for (const tema of ['light', 'dark'] as const) {
    await page.getByRole('combobox', { name: 'Tema de Empresas' }).selectOption(tema)
    await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
    for (const width of [390, 820, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: testInfo.outputPath(`empresas-${tela}-${tema}-${width}.png`),
        animations: 'disabled',
        fullPage: tela !== 'lista',
      })
    }
  }
}

test.beforeAll(async () => {
  expect(validarCnpj(CNPJ_NOVA)).toBe(true)
  expect(validarCnpj(CNPJ_EXISTENTE)).toBe(true)
  expect(validarCnpj(CNPJ_TROCA)).toBe(true)
  expect(validarCnpj(CNPJ_RECUSADO)).toBe(false)
  expect(new Set([CNPJ_NOVA, CNPJ_EXISTENTE, CNPJ_TROCA]).size).toBe(3)

  await comBancoTemporario((cliente) => cliente.query(
    `INSERT INTO empresa (cnpj, razao_social, nome_fantasia, contato_nome, telefone, email, cnae_principal)
     VALUES ($1, $2, 'Já cadastrada E2E', 'Bia', '11987654322', 'cadastrada-visual@teste.local', '4742300')
     ON CONFLICT (cnpj) DO NOTHING`,
    [CNPJ_EXISTENTE, NOME_EXISTENTE],
  ))
  expect(await contarCnpj(CNPJ_EXISTENTE)).toBe(1)
})

test('gestor consulta a tabela e confirma somente a empresa nova depois da conferência', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  expect(await contarCnpj(CNPJ_NOVA)).toBe(0)
  await entrar(page, 'gestore2e')
  await page.goto('/empresas')
  await expect(page.getByRole('heading', { name: 'Empresas', exact: true })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()

  await page.getByLabel('Buscar empresas', { exact: true }).fill(NOME_EXISTENTE)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('table')).toContainText(NOME_EXISTENTE)
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
  expect(rolagem.conteudo).toBeGreaterThan(rolagem.visivel)
  expect(rolagem.pagina).toBeLessThanOrEqual(rolagem.viewport)
  await page.getByLabel('Buscar empresas', { exact: true }).focus()
  await tabAte(page, regiaoTabela)
  expect(await regiaoTabela.evaluate((elemento) => getComputedStyle(elemento).outlineStyle)).not.toBe('none')
  await capturarEmTamanhos(page, 'lista', testInfo)

  await page.getByRole('link', { name: 'Importar empresas', exact: true }).click()
  await expect(page).toHaveURL('/empresas/importar')
  await page.getByLabel('Nome do grupo', { exact: true }).fill('Importação visual E2E')
  const arquivo = page.getByLabel('Arquivo Excel ou CSV')
  await arquivo.setInputFiles({
    name: 'empresas-mistas-e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV_MISTO, 'utf8'),
  })
  await arquivo.evaluate((elemento) => {
    const selecionado = (elemento as HTMLInputElement).files?.[0]
    ;(window as Window & { arquivoEmpresasE2E?: File }).arquivoEmpresasE2E = selecionado
  })
  await page.getByRole('button', { name: 'Conferir arquivo', exact: true }).click()

  const tituloConferencia = page.getByRole('heading', { name: 'Confira antes de importar', exact: true })
  await expect(tituloConferencia).toBeFocused()
  await expect(page.getByText('Nada foi gravado. A confirmação cria o grupo e vincula todas as empresas aceitas, incluindo as já cadastradas.', { exact: true })).toBeVisible()
  await expect(valorDoResumo(page, 'Novas empresas')).toHaveText('1')
  await expect(valorDoResumo(page, 'Já cadastradas')).toHaveText('1')
  await expect(valorDoResumo(page, 'Linhas recusadas')).toHaveText('1')
  await expect(page.getByText(`Linha 4: CNPJ com dígito verificador errado (${CNPJ_RECUSADO}). Confira na origem.`, { exact: true })).toBeVisible()
  const confirmar = page.getByRole('button', { name: 'Confirmar importação', exact: true })
  await expect(confirmar).toBeVisible()
  expect(await contarCnpj(CNPJ_NOVA)).toBe(0)
  expect(await contarCnpj(CNPJ_EXISTENTE)).toBe(1)
  expect(await contarCnpj(CNPJ_RECUSADO)).toBe(0)
  await capturarEmTamanhos(page, 'importacao-conferencia', testInfo)

  await page.getByRole('button', { name: 'Voltar ao arquivo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enviar arquivo', exact: true })).toBeFocused()
  expect(await arquivo.evaluate((elemento) => {
    const atual = (elemento as HTMLInputElement).files?.[0]
    return atual !== undefined && atual === (window as Window & { arquivoEmpresasE2E?: File }).arquivoEmpresasE2E
  })).toBe(true)
  await expect(confirmar).toHaveCount(0)

  await page.getByRole('button', { name: 'Conferir arquivo', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar importação', exact: true }).click()
  const tituloConclusao = page.getByRole('heading', { name: 'Importação concluída', exact: true })
  await expect(tituloConclusao).toBeFocused()
  await expect(page.getByText('1 empresa nova.', { exact: true })).toBeVisible()
  expect(await contarCnpj(CNPJ_NOVA)).toBe(1)
  expect(await contarCnpj(CNPJ_EXISTENTE)).toBe(1)
  expect(await contarCnpj(CNPJ_RECUSADO)).toBe(0)

  await page.getByRole('link', { name: 'Ver empresas', exact: true }).click()
  await page.getByLabel('Buscar empresas', { exact: true }).fill(NOME_NOVA)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('table')).toContainText(NOME_NOVA)
})

test('troca de arquivo invalida relatório, somente existentes permite grupo e CSV inválido recebe foco', async ({ page }, testInfo) => {
  expect(await contarCnpj(CNPJ_TROCA)).toBe(0)
  await entrar(page, 'gestore2e')
  await page.goto('/empresas/importar')
  await page.getByLabel('Nome do grupo', { exact: true }).fill('Importação de regressão E2E')
  const arquivo = page.getByLabel('Arquivo Excel ou CSV')
  await arquivo.setInputFiles({ name: 'arquivo-inicial.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV_TROCA, 'utf8') })
  await page.getByRole('button', { name: 'Conferir arquivo', exact: true }).click()
  await expect(valorDoResumo(page, 'Novas empresas')).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Confirmar importação', exact: true })).toBeVisible()
  expect(await contarCnpj(CNPJ_TROCA)).toBe(0)

  await page.getByRole('button', { name: 'Voltar ao arquivo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enviar arquivo', exact: true })).toBeFocused()
  await arquivo.focus()
  await arquivo.setInputFiles({ name: 'sem-novas.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV_ZERO_NOVAS, 'utf8') })
  await expect(page.getByRole('heading', { name: 'Enviar arquivo', exact: true })).toBeVisible()
  await expect(arquivo).toBeFocused()
  await expect(page.locator('dl')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirmar importação' })).toHaveCount(0)
  expect(await arquivo.evaluate((elemento) => (elemento as HTMLInputElement).files?.[0]?.name)).toBe('sem-novas.csv')

  await page.getByRole('button', { name: 'Conferir arquivo', exact: true }).click()
  await expect(valorDoResumo(page, 'Novas empresas')).toHaveText('0')
  await expect(valorDoResumo(page, 'Já cadastradas')).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Confirmar importação' })).toBeVisible()

  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enviar arquivo', exact: true })).toBeFocused()
  await arquivo.focus()
  await arquivo.setInputFiles({
    name: 'cabecalho-invalido.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('cnpj,nome\n1,Empresa inválida', 'utf8'),
  })
  await page.getByRole('button', { name: 'Conferir arquivo', exact: true }).click()
  const erro = page.getByRole('main').getByRole('alert')
  await expect(erro).toContainText('O cabeçalho não confere.')
  await expect(erro).toBeFocused()
  await expect(page.locator('dl')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirmar importação' })).toHaveCount(0)

  for (const tema of ['light', 'dark'] as const) {
    await page.getByRole('combobox', { name: 'Tema de Empresas' }).selectOption(tema)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(erro).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`empresas-importacao-erro-${tema}-390.png`), fullPage: true })
  }
})

test('vendedor não acessa Empresas nem importação por URL', async ({ page }) => {
  await entrar(page, 'vendedore2e')
  await expect(page.getByRole('link', { name: 'Empresas', exact: true })).toHaveCount(0)
  await page.goto('/empresas')
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/empresas/importar')
  await expect(page).toHaveURL('/meu-dia')
})
