import { expect, test, type Locator, type Page } from '@playwright/test'
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
  await expect(page).toHaveURL(apelido.includes('gestor') ? '/gestao' : '/meu-dia')
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

test('gestor consulta cards e confirma somente a empresa nova depois da conferência', async ({ page }) => {
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

  await page.getByRole('link', { name: 'Importar empresas', exact: true }).click()
  await expect(page).toHaveURL('/empresas/importar')
  await page.getByLabel('Nome do grupo', { exact: true }).fill('Importação visual E2E')
  await page.getByLabel('Resumo da lista', { exact: true }).fill('Lista visual com contato disponível')
  await page.getByLabel('Origem dos dados', { exact: true }).fill('Coleta fictícia E2E')
  await page.getByLabel('Critérios usados', { exact: true }).fill('Telefone informado')
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

  await expect(page.getByRole('main').locator('form [data-slot=card]')).toHaveCount(1)
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
  await capturarEmTamanhos(page, 'importacao-conferencia')

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
  await expect(page.getByRole('region', { name:'Empresas cadastradas' })).toContainText('Importada E2E')
})

test('troca de arquivo invalida relatório, somente existentes permite grupo e CSV inválido recebe foco', async ({ page }) => {
  expect(await contarCnpj(CNPJ_TROCA)).toBe(0)
  await entrar(page, 'gestore2e')
  await page.goto('/empresas/importar')
  await page.getByLabel('Nome do grupo', { exact: true }).fill('Importação de regressão E2E')
  await page.getByLabel('Resumo da lista', { exact: true }).fill('Lista de regressão com contato disponível')
  await page.getByLabel('Origem dos dados', { exact: true }).fill('Coleta fictícia E2E')
  await page.getByLabel('Critérios usados', { exact: true }).fill('Telefone informado')
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
    await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/empresas-importacao-erro-${tema}-390.png`, fullPage: true })
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
