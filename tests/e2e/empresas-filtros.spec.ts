import { expect, test } from '@playwright/test'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

test('gestor combina selects, conserva filtros na paginação e limpa dependentes', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('Use o harness E2E')
  exigirAdminLocal(url)
  if (!/^\/teste_[0-9a-f]{12}$/.test(new URL(url).pathname)) throw new Error('Banco temporário obrigatório')
  await comAdmin(url, async cliente => {
    await cliente.query(`INSERT INTO cep (cep, bairro, localidade, uf, ibge) VALUES
      ('30110000','Savassi','Belo Horizonte de teste','MG','3106200'),
      ('30110001','Centro mineiro','Belo Horizonte de teste','MG','3106200'),
      ('90010000','Centro gaúcho','Porto Alegre de teste','RS','4314902')`)
    await cliente.query(`INSERT INTO empresa (cnpj,razao_social,telefone,cep,cnae_principal)
      SELECT '9000000000' || lpad(n::text,4,'0'), 'Filtros E2E Empresa ' || lpad(n::text,2,'0'),
        '11987654321','30110000','4742300' FROM generate_series(1,51) n`)
    await cliente.query(`INSERT INTO empresa (cnpj,razao_social,telefone,cep,cnae_principal) VALUES
      ('90000000000052','Filtros E2E Outro bairro','11987654321','30110001','4742300'),
      ('90000000000053','Filtros E2E Sem CNAE','11987654321','30110000',NULL),
      ('90000000000054','Filtros E2E Porto Alegre','11987654321','90010000',NULL)`)
  })
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/empresas?q=Filtros+E2E')
  const estado = page.getByLabel('Estado', { exact: true })
  const cidade = page.getByLabel('Cidade', { exact: true })
  const bairro = page.getByLabel('Bairro', { exact: true })
  const cnae = page.getByLabel('CNAE', { exact: true })
  await expect(cidade).toBeDisabled()
  await expect(bairro).toBeDisabled()
  await estado.selectOption('MG')
  await expect(page).toHaveURL(/uf=MG/)
  await cidade.selectOption('3106200')
  await expect(page).toHaveURL(/cidade=3106200/)
  await bairro.selectOption('Savassi')
  await cnae.selectOption('4742300')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByText('51 empresas', { exact: true })).toBeVisible()
  const tabela = page.getByRole('table')
  await expect(tabela.getByRole('row')).toHaveCount(51)
  await expect(tabela).not.toContainText('Outro bairro')
  await expect(tabela).not.toContainText('Sem CNAE')
  await expect(tabela).not.toContainText('Porto Alegre')
  // Edição ainda não enviada não pode parecer filtro aplicado após paginar.
  await page.getByLabel('Buscar empresas', { exact: true }).fill('Rascunho não enviado')
  await cnae.selectOption('nao_informado')
  await bairro.selectOption('Centro mineiro')
  await page.getByRole('link', { name: 'Próxima', exact: true }).click()
  await expect(tabela.getByRole('row')).toHaveCount(2)
  await expect(tabela).toContainText('Filtros E2E Empresa 51')
  const params = new URL(page.url()).searchParams
  expect(Object.fromEntries(params)).toEqual({ q: 'Filtros E2E', cnae: '4742300', uf: 'MG', cidade: '3106200', bairro: 'Savassi', pagina: '2' })
  await expect(page.getByLabel('Buscar empresas', { exact: true })).toHaveValue('Filtros E2E')
  await expect(cnae).toHaveValue('4742300')
  await expect(bairro).toHaveValue('Savassi')

  for (const tema of ['light', 'dark']) {
    await page.getByLabel('Tema de Empresas').selectOption(tema)
    for (const width of [390, 820, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: testInfo.outputPath(`empresas-filtros-${tema}-${width}.png`), fullPage: true, animations: 'disabled' })
    }
  }

  await estado.selectOption('RS')
  await expect(page).toHaveURL(/uf=RS/)
  await expect(cidade).toHaveValue('')
  await expect(bairro).toBeDisabled()
  expect(new URL(page.url()).searchParams.has('pagina')).toBe(false)
  expect(new URL(page.url()).searchParams.has('bairro')).toBe(false)
  await cidade.selectOption('4314902')
  await expect(page).toHaveURL(/cidade=4314902/)
  await cnae.selectOption('nao_informado')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByText('1 empresa', { exact: true })).toBeVisible()
  await expect(tabela).toContainText('Filtros E2E Porto Alegre')
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).click()
  await expect(page).toHaveURL('/empresas')
  await expect(page.getByLabel('Buscar empresas', { exact: true })).toHaveValue('')
  await expect(estado).toHaveValue('')
  await expect(cnae).toHaveValue('')
  await expect(cidade).toBeDisabled()
  await expect(bairro).toBeDisabled()
  await page.getByLabel('Buscar empresas', { exact: true }).fill('Outro rascunho')
  await cnae.selectOption('4742300')
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).click()
  await expect(page).toHaveURL('/empresas')
  await expect(page.getByLabel('Buscar empresas', { exact: true })).toHaveValue('')
  await expect(cnae).toHaveValue('')
})
