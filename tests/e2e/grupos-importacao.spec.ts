import { expect, test, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness, comBancoGrupos, prepararGrupos, GRUPOS, CNPJ_JORNADA_NOVA, CNPJ_JORNADA_OVERLAP, CNPJ_JORNADA_CARTEIRA } from './dados-grupos'

const NOVA = 'Jornada Grupos Nova fictícia'
const OVERLAP = 'Jornada Grupos Compartilhada fictícia'
const CARTEIRA = 'Jornada Grupos Carteira fictícia'
const NOME = 'Jornada de importação XLSX'
const RENOMEADO = 'Jornada renomeada'

async function entrar(page: Page, apelido = 'gruposgestore2e') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(apelido.includes('gestor') ? '/gestao' : '/meu-dia')
}

async function planilha(linhas: string[][]) {
  const livro = new ExcelJS.Workbook()
  const aba = livro.addWorksheet('Empresas')
  aba.addRow(['cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'telefone', 'email', 'cep', 'cnae_principal'])
  for (const linha of linhas) aba.addRow(linha)
  return Buffer.from(await livro.xlsx.writeBuffer())
}

function linha(cnpj: string, nome: string, telefone = '11999990777') {
  return [cnpj, nome, 'Fantasia da planilha', 'Pessoa fictícia', telefone, 'grupo@teste.local', '', '7777702']
}

async function conferir(page: Page, nome: string, buffer: Buffer) {
  await page.goto('/empresas/importar')
  await page.getByLabel('Nome do grupo', { exact: true }).fill(nome)
  await page.getByLabel('Arquivo Excel ou CSV').setInputFiles({ name: 'jornada-grupos.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer })
  await page.getByRole('button', { name: 'Conferir arquivo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Confira antes de importar' })).toBeFocused()
  await expect(page.getByText('Nada foi gravado.', { exact: false })).toBeVisible()
}

function resumo(page: Page, nome: string) {
  return page.locator('dt').filter({ hasText: new RegExp(`^${nome}$`) }).locator('xpath=following-sibling::dd')
}

async function estadoImportacao() {
  return comBancoGrupos(async c => {
    const tabelas = ['empresa', 'grupo_importacao', 'grupo_importacao_empresa']
    const estado = []
    for (const tabela of tabelas) estado.push((await c.query(`SELECT * FROM ${tabela} ORDER BY 1, 2`)).rows)
    return estado
  })
}

test.beforeAll(async () => {
  const banco = bancoGruposDoHarness()
  // Playwright reinicia o worker após uma falha. A preparação já concluída
  // continua neste banco; verificar as testemunhas evita duplicar usuários.
  const pronta = await banco.sql<{ id: string }>("SELECT id FROM usuario WHERE email='gruposjornadae2e@teste.local'")
  if (pronta.length) {
    expect(await banco.sql('SELECT id FROM grupo_importacao WHERE id=ANY($1::uuid[])', [GRUPOS.map(g => g[0])])).toHaveLength(6)
    expect(await banco.sql('SELECT id FROM empresa WHERE cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).toHaveLength(1)
    return
  }
  await prepararGrupos(banco)
  const vendedor = await criarUsuarioComSenha(banco, 'vendedor', 'gruposjornadae2e', 'Senha-e2e-2026')
  const [{ id }] = await banco.sql<{ id: string }>(`INSERT INTO empresa(cnpj,razao_social,telefone,contato_nome,email,cnae_principal)
    VALUES ($1,$2,'11911112222','Contato preservado','preservado@teste.local','7777702') RETURNING id`, [CNPJ_JORNADA_CARTEIRA, CARTEIRA])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)', [id, vendedor.id])
  await banco.sql(`INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data)
    VALUES ($1,'acompanhamento','Histórico preservado da jornada','Retorno preservado',(now() AT TIME ZONE 'America/Sao_Paulo')::date)`, [id])
})

test('XLSX confirma grupo, reimporta existentes sem sobrescrever e preserva atendimento ao desativar', async ({ page, browser }) => {
  test.setTimeout(90_000)
  await entrar(page)
  const antes = await estadoImportacao()
  const cadastroAntes = await comBancoGrupos(async c => (await c.query('SELECT * FROM empresa WHERE cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)
  const filaAntes = await comBancoGrupos(async c => (await c.query('SELECT f.* FROM empresa_fila f JOIN empresa e ON e.id=f.empresa_id WHERE e.cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)
  const contatoAntes = await comBancoGrupos(async c => (await c.query('SELECT c.* FROM contato c JOIN empresa e ON e.id=c.empresa_id WHERE e.cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)
  expect(filaAntes).toHaveLength(1)
  expect(contatoAntes).toHaveLength(1)
  await conferir(page, NOME, await planilha([linha(CNPJ_JORNADA_NOVA, NOVA), linha(CNPJ_JORNADA_OVERLAP, OVERLAP), linha(CNPJ_JORNADA_CARTEIRA, 'Sobrescrita proibida')]))
  await expect(resumo(page, 'Novas empresas')).toHaveText('2')
  await expect(resumo(page, 'Já cadastradas')).toHaveText('1')
  expect(await estadoImportacao()).toEqual(antes)
  await page.getByRole('button', { name: 'Confirmar importação', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeFocused()
  await expect(page.getByText('2 empresas novas.', { exact: true })).toBeVisible()
  await expect(page.getByText('3 empresas no grupo.', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Ver grupo', exact: true }).click()
  await expect(page).toHaveURL(/\/empresas\/grupos\/[0-9a-f-]{36}$/)
  const urlGrupo = page.url()
  await expect(page.getByRole('heading', { name: NOME, exact: true })).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(4)
  expect(await comBancoGrupos(async c => (await c.query('SELECT * FROM empresa WHERE cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)).toEqual(cadastroAntes)

  const aposPrimeira = await estadoImportacao()
  await conferir(page, 'Outra origem da jornada', await planilha([linha(CNPJ_JORNADA_OVERLAP, 'Outro nome proibido', '11955556666')]))
  await expect(resumo(page, 'Novas empresas')).toHaveText('0')
  await expect(resumo(page, 'Já cadastradas')).toHaveText('1')
  expect(await estadoImportacao()).toEqual(aposPrimeira)
  await page.getByRole('button', { name: 'Confirmar importação', exact: true }).click()
  await expect(page.getByText('0 empresas novas.', { exact: true })).toBeVisible()
  await expect(page.getByText('1 empresa no grupo.', { exact: true })).toBeVisible()
  expect(await comBancoGrupos(async c => (await c.query('SELECT razao_social,telefone FROM empresa WHERE cnpj=$1', [CNPJ_JORNADA_OVERLAP])).rows)).toEqual([{ razao_social: OVERLAP, telefone: '11999990777' }])

  await page.goto(urlGrupo)
  await page.getByRole('button', { name: 'Renomear', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Nome do grupo').fill(RENOMEADO)
  await page.getByRole('button', { name: 'Salvar nome', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: RENOMEADO, exact: true })).toBeVisible()
  const desativar = page.getByRole('button', { name: 'Desativar grupo', exact: true })
  await desativar.click()
  await expect(page.getByRole('dialog')).toContainText('1 empresas disponíveis deixarão de aparecer')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(desativar).toBeFocused()
  await expect(page.getByText('Ativo', { exact: true })).toBeVisible()
  await desativar.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reativar grupo' })).toBeVisible()
  const tabela = page.getByRole('table')
  await expect(tabela.getByRole('row').filter({ hasText: NOVA })).toContainText('Origem bloqueada')
  await expect(tabela.getByRole('row').filter({ hasText: OVERLAP })).toContainText('Disponível')
  await expect(tabela.getByRole('row').filter({ hasText: CARTEIRA })).toContainText('Em carteira')
  expect(await comBancoGrupos(async c => (await c.query('SELECT f.* FROM empresa_fila f JOIN empresa e ON e.id=f.empresa_id WHERE e.cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)).toEqual(filaAntes)
  expect(await comBancoGrupos(async c => (await c.query('SELECT c.* FROM contato c JOIN empresa e ON e.id=c.empresa_id WHERE e.cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)).toEqual(contatoAntes)
  await page.getByRole('link', { name: 'Todas as empresas', exact: true }).click()
  await page.getByLabel('Buscar empresas').fill('Jornada Grupos')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(4)
  await expect(page.getByRole('table')).toContainText(NOVA)

  const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const vendedor = await contexto.newPage()
    await entrar(vendedor, 'gruposjornadae2e')
    await expect(vendedor.getByRole('heading', { name: CARTEIRA, exact: true })).toBeVisible()
    await vendedor.goto('/carteira')
    await expect(vendedor.getByRole('heading', { name: CARTEIRA, exact: true })).toBeVisible()
    await vendedor.getByRole('link', { name: 'Ver cliente', exact: true }).click()
    await expect(vendedor.getByText('Histórico preservado da jornada', { exact: true })).toBeVisible()
    await vendedor.goto(`/fila/localizar?nome=${encodeURIComponent(NOVA)}`)
    await expect(vendedor.getByText('Nenhuma empresa encontrada.', { exact: true })).toBeVisible()
    await vendedor.goto(`/fila/localizar?nome=${encodeURIComponent(OVERLAP)}`)
    await vendedor.getByRole('button', { name: 'Reservar para ligar', exact: true }).click()
    await expect(vendedor.getByRole('heading', { name: OVERLAP, exact: true })).toBeVisible()
    await expect(vendedor.getByText('11999990777', { exact: true })).toBeVisible()
    await page.goto(urlGrupo)
    await page.getByRole('button', { name: 'Reativar grupo', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('table').getByRole('row').filter({ hasText: NOVA })).toContainText('Disponível')
    await vendedor.goto(`/fila/localizar?nome=${encodeURIComponent(NOVA)}`)
    await expect(vendedor.getByRole('heading', { name: NOVA, exact: true })).toBeVisible()
  } finally { await contexto.close() }
})

test('gestão real de grupos cabe em 390, 820 e 1280 nos dois temas com diálogo e página vazia', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await entrar(page)
  for (const tema of ['light', 'dark']) {
    for (const width of [390, 820, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/empresas/grupos')
      await page.getByLabel('Tema de Empresas').selectOption(tema)
      await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
      await expect(page.getByRole('table')).toContainText(GRUPOS[0][1])
      const linhasDasBadges = await page.getByRole('table').getByText('Desativado', { exact: true }).evaluateAll(badges => badges.map(badge => {
        const faixa = document.createRange()
        faixa.selectNodeContents(badge)
        return faixa.getClientRects().length
      }))
      expect(linhasDasBadges.length).toBeGreaterThan(0)
      expect(linhasDasBadges.every(linhas => linhas === 1)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`grupos-lista-${tema}-${width}.png`), fullPage: true })
      // Playwright rola o container até o link real, inclusive em 390px.
      await page.getByRole('link', { name: `Ver grupo ${GRUPOS[0][1]}`, exact: true }).click()
      await expect(page.getByRole('heading', { name: GRUPOS[0][1], exact: true })).toBeVisible()
      await expect(page.getByText('Importado por gruposgestore2e em', { exact: false })).toBeVisible()
      await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
      await expect(resumo(page, 'Empresas')).toHaveText('5')
      await expect(resumo(page, 'Disponíveis')).toHaveText('2')
      await expect(resumo(page, 'Em carteiras')).toHaveText('1')
      await expect(resumo(page, 'Reservadas')).toHaveText('1')
      await expect(resumo(page, 'Outros impedimentos')).toHaveText('1')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`grupos-detalhe-${tema}-${width}.png`), fullPage: true })
      const abrir = page.getByRole('button', { name: 'Desativar grupo', exact: true })
      await abrir.click()
      const dialogo = page.getByRole('dialog')
      await expect(dialogo).toContainText('1 empresas disponíveis deixarão de aparecer')
      await expect(page.locator('.ui-dialog-portal')).toHaveAttribute('data-theme', tema)
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
        expect(await dialogo.evaluate(e => e.contains(document.activeElement))).toBe(true)
      }
      const caixa = await dialogo.boundingBox()
      expect(caixa).not.toBeNull()
      expect(caixa!.x).toBeGreaterThanOrEqual(0)
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`grupos-dialogo-${tema}-${width}.png`) })
      await page.keyboard.press('Escape')
      await expect(dialogo).toHaveCount(0)
      await expect(abrir).toBeFocused()
      await page.goto('/empresas/grupos?pagina=999')
      await page.getByLabel('Tema de Empresas').selectOption(tema)
      await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
      await expect(page.getByRole('heading', { name: 'Nenhum grupo nesta página' })).toBeVisible()
      await expect(page.getByText('Volte à primeira página para consultar os grupos existentes.')).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`grupos-vazio-${tema}-${width}.png`), fullPage: true })
      await page.getByRole('link', { name: 'Voltar à primeira página', exact: true }).click()
      await expect(page.getByRole('table')).toBeVisible()
    }
  }
})

test('vendedor não acessa lista nem detalhe de grupos por URL direta', async ({ page }) => {
  await entrar(page, 'gruposvendedore2e')
  for (const caminho of ['/empresas/grupos', `/empresas/grupos/${GRUPOS[0][0]}`]) {
    await page.goto(caminho)
    await expect(page).toHaveURL('/meu-dia')
    await expect(page.getByRole('heading', { name: 'Meu dia', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Desativar grupo', exact: true })).toHaveCount(0)
  }
})
