import { expect, test, type Page } from '@playwright/test'
import { comBancoGrupos } from './dados-grupos'

async function entrar(page: Page, apelido = 'redesigne2e') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(apelido === 'gestore2e' ? '/gestao' : '/meu-dia')
}

test('acesso à busca e localização convivem no redesign da Prospecção', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await entrar(page)
  await page.goto('/fila')
  await expect(page.getByRole('button', { name: 'Localizar empresas', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Planejar buscas', exact: true }).click()
  await expect(page).toHaveURL('/fila/google')
  await expect(page.getByRole('heading', { name: 'Buscas no Google', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar planejamento', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar às opções', exact: true }).click()
  await page.getByRole('link', { name: 'Buscar novas empresas', exact: true }).click()
  await expect(page).toHaveURL('/fila/buscar?fonte=banco')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const tema of ['light', 'dark']) {
      await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({ path: testInfo.outputPath(`busca-cnpj-${width}-${tema}.png`), fullPage: true })
    }
  }
})

test('consulta simulada persiste, não repete no refresh e importa dados nas abas', async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000)
  await entrar(page)
  await page.goto('/fila/buscar')
  await expect(page.getByRole('button', { name: 'Buscar empresas', exact: true })).toBeEnabled()
  await page.getByLabel('Nome ou palavra-chave', { exact: true }).fill('iluminação')
  await page.getByLabel('CNAEs', { exact: true }).fill('4742300')
  await page.getByRole('button',{name:'Localização',exact:true}).click()
  await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('SP')
  await page.getByRole('button',{name:'Resultados e dados retornados',exact:true}).click()
  await page.getByLabel('Nome da lista', { exact: true }).fill('Nova consulta integrada fictícia')
  await page.getByRole('spinbutton', { name: /^Quantidade de empresas/ }).fill('2')
  await page.getByRole('button', { name: 'Buscar empresas', exact: true }).click()
  await expect(page).toHaveURL(/busca=[0-9a-f-]{36}/)
  const buscaId = new URL(page.url()).searchParams.get('busca')!
  const chamadas = async () => (await (await fetch(process.env.CNPJ_BIZ_MOCK_URL + '/estatisticas')).json()).consultas
  const chamadasDepois = await chamadas()
  await expect(page.getByRole('heading', { name: 'Luminárias Horizonte fictícia', exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Selecionar Comércio sem telefone fictício', exact: true })).toBeDisabled()
  const conferir = () => comBancoGrupos(async c => (await c.query(
    `SELECT b.estado,b.fornecedor,b.quantidade,jsonb_array_length(b.empresas) AS retornadas,
      (SELECT count(*)::int FROM busca_empresa WHERE usuario_id=b.usuario_id AND nome=b.nome) AS tentativas
     FROM busca_empresa b WHERE b.id=$1`, [buscaId])).rows[0])
  expect(await conferir()).toEqual({ estado: 'concluida', fornecedor: 'Casa dos Dados', quantidade: 2, retornadas: 2, tentativas: 1 })
  await page.reload()
  expect(await chamadas()).toBe(chamadasDepois)
  expect(await conferir()).toEqual({ estado: 'concluida', fornecedor: 'Casa dos Dados', quantidade: 2, retornadas: 2, tentativas: 1 })
  await page.getByRole('checkbox', { name: 'Selecionar Luminárias Horizonte fictícia', exact: true }).check()
  await page.getByRole('button', { name: 'Importar selecionadas', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('1 empresas novas')
  const empresa = await comBancoGrupos(async c => (await c.query('SELECT id FROM empresa WHERE cnpj=$1', ['99887766000105'])).rows[0])
  await page.goto('/fila/localizar/' + empresa.id)
  await expect(page.getByRole('heading', { name: 'Dados cadastrais da Casa dos Dados' })).toBeVisible()
  // Importar não transfere posse. A ficha abaixo usa uma posse criada somente
  // na fixture, como as demais jornadas de Carteira; o fluxo de reserva tem E2E próprio.
  await comBancoGrupos(async c => {
    const fila = (await c.query('SELECT vendedor_id FROM empresa_fila WHERE empresa_id=$1', [empresa.id])).rows[0]
    expect(fila?.vendedor_id ?? null).toBeNull()
    await c.query(`INSERT INTO empresa_fila(empresa_id,vendedor_id)
      SELECT $1,id FROM usuario WHERE email='redesigne2e@teste.local'
      ON CONFLICT(empresa_id) DO UPDATE SET vendedor_id=excluded.vendedor_id`, [empresa.id])
  })
  await page.goto('/carteira/' + empresa.id)
  const dados = page.getByRole('tabpanel', { name: 'Dados da empresa', exact: true })
  await expect(dados.getByRole('heading', { name: 'Dados cadastrais da Casa dos Dados' })).toBeVisible()
  await page.getByRole('tab', { name: 'Histórico', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dados cadastrais da Casa dos Dados' })).not.toBeVisible()
  await page.getByRole('tab', { name: 'Dados da empresa', exact: true }).click()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const tema of ['light', 'dark']) {
      await page.getByLabel('Tema da Carteira').selectOption(tema)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({ path: testInfo.outputPath(`ficha-cnpj-${width}-${tema}.png`), fullPage: true })
    }
  }
  const contextoGestor = await browser.newContext()
  try {
    const gestor = await contextoGestor.newPage()
    await entrar(gestor, 'gestore2e')
    await gestor.goto('/empresas/' + empresa.id)
    await expect(gestor.getByRole('tabpanel', { name: 'Dados da empresa', exact: true }).getByRole('heading', { name: 'Dados cadastrais da Casa dos Dados' })).toBeVisible()
    await gestor.getByRole('tab', { name: 'Histórico', exact: true }).click()
    await expect(gestor.getByRole('heading', { name: 'Dados cadastrais da Casa dos Dados' })).not.toBeVisible()
    await gestor.goto('/empresas/busca')
    await expect(gestor.getByRole('navigation', { name: 'Localização atual' })).toContainText('Busca de empresas')
    for (const width of [1440, 390]) {
      await gestor.setViewportSize({ width, height: 900 })
      for (const tema of ['light', 'dark']) {
        await gestor.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
        await expect.poll(() => gestor.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
        await gestor.screenshot({ path: testInfo.outputPath(`gestao-cnpj-${width}-${tema}.png`), fullPage: true })
      }
    }
  } finally { await contextoGestor.close() }
})
