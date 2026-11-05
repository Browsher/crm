import { expect, test, type Page } from '@playwright/test'
import { comBancoGrupos } from './dados-grupos'
import { EMPRESA_MEU_DIA_PRIVADA, EMPRESA_MEU_DIA_POSSE_PERDIDA, EMPRESA_MEU_DIA_REAGENDA } from './dados-meu-dia'

const lista = (page: Page) => page.getByTestId('lista-meu-dia')
const painel = (page: Page) => page.locator('[data-painel-lateral]')
const card = (page: Page, nome: string) => lista(page).getByRole('listitem').filter({ has: page.locator('strong', { hasText: nome }) })
const filtros = (page: Page) => page.getByRole('group', { name: 'Filtrar retornos' })
const pasta = 'docs/design/2026-11-05-meu-dia'

async function entrar(page: Page, apelido = 'meudiae2e') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(apelido + '@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
}

async function abrirRetorno(page: Page, nome: string) {
  await card(page, nome).getByRole('button', { name: 'Abrir retorno', exact: true }).click()
  await expect(painel(page).getByRole('heading', { name: nome, exact: true })).toBeVisible()
}

test('cards iniciam sem seleção nem leitura, incluem futuros e filtram por períodos civis de Brasília', async ({ page }) => {
  const leituras: string[] = []
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/meu-dia')) leituras.push(r.postData() ?? '') })
  await entrar(page)
  await expect(page.getByText('Nenhum retorno selecionado', { exact: true })).toBeVisible()
  await expect(painel(page)).toHaveCount(0)
  expect(leituras).toEqual([])
  await expect(lista(page).getByRole('listitem')).toHaveCount(18)
  await expect(page.getByText('18 de 18 retornos', { exact: true })).toBeVisible()
  expect((await lista(page).locator('li strong').allTextContents()).slice(0, 2)).toEqual(['Meu Dia Atraso A14', 'Meu Dia Atraso A13'])
  for (const excluida of ['Meu Dia SemContato Ignorado', 'Meu Dia Arquivada', 'Meu Dia Privada Ignorada']) {
    await expect(page.getByRole('main')).not.toContainText(excluida)
  }
  await filtros(page).getByRole('button', { name: 'Atrasos', exact: true }).click()
  await expect(lista(page).getByRole('listitem')).toHaveCount(10)
  await filtros(page).getByRole('button', { name: 'Hoje', exact: true }).click()
  await expect(lista(page).getByRole('listitem')).toHaveCount(4)
  await filtros(page).getByRole('button', { name: 'Próximos', exact: true }).click()
  await expect(lista(page).getByRole('listitem')).toHaveCount(4)
  const periodos = [['amanha', 'Meu Dia Amanhã'], ['semana_que_vem', 'Meu Dia Semana Que Vem'], ['mes_que_vem', 'Meu Dia Mês Que Vem']] as const
  // Datas esperadas vêm do PG local, sem reaproveitar a função de filtro do app.
  const datas = await comBancoGrupos(async c => (await c.query<{ nome: string; data: string; amanha: boolean; semana_que_vem: boolean; mes_que_vem: boolean }>(`SELECT e.razao_social nome,to_char(c.proximo_passo_data,'YYYY-MM-DD') data,
    c.proximo_passo_data=(now() AT TIME ZONE 'America/Sao_Paulo')::date+1 amanha,
    c.proximo_passo_data BETWEEN date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')::date+7 AND date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')::date+13 semana_que_vem,
    c.proximo_passo_data >= (date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')+interval '1 month')::date AND c.proximo_passo_data < (date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')+interval '2 months')::date mes_que_vem
    FROM empresa e JOIN empresa_vinculo v ON v.empresa_id=e.id JOIN contato c ON c.id=v.agenda_contato_id WHERE e.razao_social = ANY($1)`, [periodos.map(([, nome]) => nome)])).rows)
  for (const [periodo, nome] of periodos) {
    await page.getByLabel('Período dos próximos retornos').selectOption(periodo)
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
    const esperadas = datas.filter(d => d[periodo])
    await expect(lista(page).getByRole('listitem')).toHaveCount(esperadas.length)
    await expect(card(page, nome)).toBeVisible()
    for (const linha of esperadas) await expect(card(page, linha.nome).locator('time')).toHaveAttribute('datetime', linha.data)
    await expect(page.getByText('Nenhum retorno selecionado', { exact: true })).toBeVisible()
  }
  await page.goto(`/carteira/${EMPRESA_MEU_DIA_PRIVADA}?de=meu-dia`)
  await expect(page.locator('body')).toContainText('404')
})

test('retorno, dados e negociação respeitam Voltar, tabs, teclado, temas e rodapés alcançáveis', async ({ page }) => {
  await entrar(page)
  for (const tema of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Tema do Meu dia' }).selectOption(tema)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const alturas = await lista(page).getByRole('listitem').evaluateAll(itens => itens.map(i => i.getBoundingClientRect().height))
      expect(new Set(alturas).size).toBe(1)
      await page.screenshot({ path: `${pasta}/cards-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })
      const gatilho = card(page, 'Meu Dia Aurora').getByRole('button', { name: 'Abrir retorno' })
      await page.getByLabel('Nome', { exact: true }).focus()
      for (let i = 0; i < 50 && !await gatilho.evaluate(el => el === document.activeElement); i++) await page.keyboard.press('Tab')
      await expect(gatilho).toBeFocused()
      expect(await gatilho.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
      await gatilho.press('Enter')
      await expect(painel(page).getByRole('tab', { name: 'Próximo passo', exact: true })).toHaveAttribute('aria-selected', 'true')
      if (width === 1440) {
        const grade = (await lista(page).boundingBox())!, lateral = (await painel(page).boundingBox())!
        expect(lateral.x - grade.x - grade.width).toBeLessThanOrEqual(33)
      }
      await expect(painel(page).getByRole('tab', { name: 'Resumo', exact: true })).toHaveCount(0)
      await expect(painel(page).getByRole('button', { name: 'Registrar atendimento', exact: true })).toHaveCount(0)
      const historico = painel(page).getByRole('tab', { name: 'Histórico', exact: true })
      await painel(page).getByRole('tab', { name: 'Próximo passo', exact: true }).press('ArrowRight')
      await expect(historico).toBeFocused()
      await expect(painel(page).locator('details')).toHaveCount(1)
      await expect(painel(page).locator('details')).not.toHaveAttribute('open', '')
      await page.screenshot({ path: `${pasta}/retorno-${tema}-${width}.png`, animations: 'disabled' })
      await painel(page).getByRole('button', { name: 'Dados da empresa', exact: true }).click()
      await expect(painel(page)).toContainText('Cadastro')
      await page.screenshot({ path: `${pasta}/dados-${tema}-${width}.png`, animations: 'disabled' })
      const comercialDados = painel(page).locator('footer').getByRole('button', { name: 'Negociação', exact: true })
      await comercialDados.scrollIntoViewIfNeeded()
      await comercialDados.press('Enter')
      await expect(painel(page)).toHaveCount(1)
      await expect(painel(page).getByRole('button', { name: 'Registrar venda', exact: true })).toBeVisible()
      await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
      await expect(painel(page).getByRole('heading', { name: 'Dados da empresa', exact: true })).toBeVisible()
      await expect(comercialDados).toBeFocused()
      await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
      await expect(historico).toHaveAttribute('aria-selected', 'true')
      await expect(painel(page).getByRole('button', { name: 'Dados da empresa', exact: true })).toBeFocused()
      await painel(page).getByRole('button', { name: 'Negociação', exact: true }).click()
      await expect(painel(page).getByRole('tab', { name: 'Atendimento', exact: true })).toBeVisible()
      for (const aba of ['Próximo passo', 'Histórico']) {
        await painel(page).getByRole('tab', { name: aba, exact: true }).click()
        const venda = painel(page).getByRole('button', { name: 'Registrar venda', exact: true })
        const arquivo = painel(page).getByRole('button', { name: 'Sem interesse', exact: true })
        await venda.scrollIntoViewIfNeeded()
        const a = (await venda.boundingBox())!, b = (await arquivo.boundingBox())!
        expect(Math.abs(a.y - b.y)).toBeLessThan(2)
        expect(a.x + a.width).toBeLessThanOrEqual(b.x)
        expect(b.x + b.width).toBeLessThanOrEqual(width)
        expect(a.y + a.height).toBeLessThanOrEqual(900)
      }
      await page.screenshot({ path: `${pasta}/negociacao-${tema}-${width}.png`, animations: 'disabled' })
      await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
      await expect(painel(page).getByRole('tab', { name: 'Próximo passo', exact: true })).toHaveAttribute('aria-selected', 'true')
      await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
      await expect(historico).toHaveAttribute('aria-selected', 'true')
      await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
      await painel(page).getByRole('button', { name: 'Fechar', exact: true }).click()
      await expect(gatilho).toBeFocused()
    }
  }
})

test('cliente leva todos os filtros para a Carteira e retorna sem selecionar vizinho', async ({ page }) => {
  await entrar(page)
  await page.getByLabel('Nome', { exact: true }).fill('Amanhã')
  await filtros(page).getByRole('button', { name: 'Próximos', exact: true }).click()
  await page.getByLabel('Período dos próximos retornos').selectOption('amanha')
  await page.getByLabel('Nome', { exact: true }).press('Enter')
  await expect(lista(page).getByRole('listitem')).toHaveCount(1)
  await expect(page).toHaveURL(/periodo=amanha/)
  const query = new URL(page.url()).search
  await abrirRetorno(page, 'Meu Dia Amanhã')
  await painel(page).getByRole('link', { name: 'Atendimento', exact: true }).click()
  await expect(page).toHaveURL(/\/carteira\/.*de=meu-dia.*nome=.*retorno=proximos.*periodo=amanha/)
  await expect(page.getByRole('heading', { name: 'Meu Dia Amanhã', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar para o Meu dia', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia' + query)
  await expect(painel(page)).toHaveCount(0)
  await expect(card(page, 'Meu Dia Amanhã')).toBeVisible()
})

test('vazio diferencia agenda sem retornos de busca sem resultado', async ({ page }) => {
  await entrar(page, 'meudiavazioe2e')
  await expect(page.getByRole('heading', { name: 'Nenhum retorno pendente', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver carteira completa', exact: true })).toHaveAttribute('href', '/carteira')
  await page.getByLabel('Nome', { exact: true }).fill('Não existe')
  await page.getByLabel('Nome', { exact: true }).press('Enter')
  await expect(page.getByRole('heading', { name: 'Nenhuma empresa corresponde à busca', exact: true })).toBeVisible()
})

test('reagendar para o futuro mantém empresa na agenda e na Carteira', async ({ page }) => {
  await entrar(page)
  await abrirRetorno(page, 'Meu Dia Atraso Reagenda')
  await painel(page).getByRole('link', { name: 'Atendimento', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/carteira/${EMPRESA_MEU_DIA_REAGENDA}\\?de=meu-dia`))
  const data = await comBancoGrupos(async c => (await c.query<{ data: string }>(`SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + 7, 'YYYY-MM-DD') data`)).rows[0].data)
  await page.getByRole('button', { name: 'Registrar atendimento', exact: true }).click()
  await page.getByLabel('Nota', { exact: true }).fill('Reagendado para o futuro pelo Meu dia')
  await page.getByLabel('Próximo passo', { exact: true }).fill('Retomar contato mais adiante')
  await page.getByLabel('Data do próximo passo', { exact: true }).fill(data)
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByLabel('Nota', { exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Histórico', exact: true }).click()
  await page.getByRole('button', { name: 'Expandir todos', exact: true }).click()
  await expect(page.getByText('Reagendado para o futuro pelo Meu dia', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar para o Meu dia', exact: true }).click()
  await expect(card(page, 'Meu Dia Atraso Reagenda')).toContainText('Próximo')
  await filtros(page).getByRole('button', { name: 'Atrasos', exact: true }).click()
  await expect(lista(page)).not.toContainText('Meu Dia Atraso Reagenda')
})

test('perda de vínculo ao abrir remove card sem serializar histórico privado', async ({ page }) => {
  await entrar(page)
  const total = await lista(page).getByRole('listitem').count()
  await comBancoGrupos(c => c.query('UPDATE empresa_vinculo SET vendedor_id=(SELECT id FROM usuario WHERE email=$2) WHERE empresa_id=$1', [EMPRESA_MEU_DIA_POSSE_PERDIDA, 'meudiaprivadae2e@teste.local']))
  let payload = ''
  await page.route('**/meu-dia*', async rota => {
    if (rota.request().method() !== 'POST') return rota.continue()
    const resposta = await rota.fetch()
    payload = await resposta.text()
    await rota.fulfill({ response: resposta })
  })
  await card(page, 'Meu Dia Posse Perdida').getByRole('button', { name: 'Abrir retorno' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Esta empresa não está mais na sua agenda')
  expect(payload).not.toBe('')
  expect(payload).not.toContain('Nota de Meu Dia Posse Perdida')
  await expect(painel(page)).toHaveCount(0)
  await expect(lista(page).getByRole('listitem')).toHaveCount(total - 1)
  await expect(page.getByRole('main')).not.toContainText('11999990401')
})


test('Dados direto oferece negociação e Voltar fecha com foco no card, sem seleção automática', async ({ page }) => {
  await entrar(page)
  const gatilho = card(page, 'Meu Dia Aurora').getByRole('button', { name: 'Dados da empresa', exact: true })
  await gatilho.press('Enter')
  await expect(painel(page).locator('header').getByRole('button')).toHaveText('Voltar')
  await painel(page).locator('footer').getByRole('button', { name: 'Negociação', exact: true }).press('Enter')
  await expect(painel(page)).toHaveCount(1)
  await painel(page).getByRole('tab', { name: 'Atendimento', exact: true }).click()
  await painel(page).getByRole('textbox', { name: 'Nota', exact: true }).fill('Preservar contexto Dados')
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  const descarte = page.getByRole('dialog', { name: 'Descartar alterações?', exact: true })
  await expect(descarte).toBeVisible()
  await descarte.getByRole('button', { name: 'Continuar editando', exact: true }).click()
  await expect(painel(page).getByRole('textbox', { name: 'Nota', exact: true })).toHaveValue('Preservar contexto Dados')
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  await descarte.getByRole('button', { name: 'Descartar', exact: true }).click()
  await expect(painel(page).getByRole('tab', { name: 'Próximo passo', exact: true })).toHaveAttribute('aria-selected', 'true')
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  await expect(painel(page).getByRole('heading', { name: 'Dados da empresa', exact: true })).toBeVisible()
  await expect(painel(page).locator('footer').getByRole('button', { name: 'Negociação', exact: true })).toBeFocused()
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  await expect(painel(page)).toHaveCount(0)
  await expect(gatilho).toBeFocused()
  await expect(page.getByText('Nenhum retorno selecionado', { exact: true })).toBeVisible()
})

for (const [nome, situacao] of [['Meu Dia Amanhã', 'cliente'], ['Meu Dia Semana Que Vem', 'tentativa']] as const) {
  test(`Dados de ${situacao} usa Atendimento com nome, retorno e período intactos`, async ({ page }) => {
    await entrar(page)
    const periodo = situacao === 'cliente' ? 'amanha' : 'semana_que_vem'
    const query = new URLSearchParams({ nome, retorno: 'proximos', periodo })
    await page.goto('/meu-dia?' + query)
    await card(page, nome).getByRole('button', { name: 'Dados da empresa', exact: true }).click()
    const link = painel(page).locator('footer').getByRole('link', { name: 'Atendimento', exact: true })
    const destino = new URL((await link.getAttribute('href'))!, page.url())
    expect(destino.searchParams.get('de')).toBe('meu-dia')
    for (const [chave, valor] of query) expect(destino.searchParams.get(chave)).toBe(valor)
    await link.press('Enter')
    await expect(page).toHaveURL(new RegExp('/carteira/.*de=meu-dia'))
    const url = new URL(page.url())
    for (const [chave, valor] of query) expect(url.searchParams.get(chave)).toBe(valor)
    await page.getByRole('link', { name: 'Voltar para o Meu dia', exact: true }).click()
    await expect(page).toHaveURL('/meu-dia?' + query)
    await expect(painel(page)).toHaveCount(0)
  })
}


for (const tema of ['light', 'dark']) {
  for (const width of [1440, 390]) {
    test(`rodapé comercial de Dados permanece na viewport antes de rolar em ${tema}/${width}`, async ({ page }) => {
      await entrar(page)
      await page.getByRole('combobox', { name: 'Tema do Meu dia' }).selectOption(tema)
      await page.setViewportSize({ width, height: 1000 })
      await card(page, 'Meu Dia Aurora').getByRole('button', { name: 'Dados da empresa', exact: true }).click()
      await expect(painel(page)).toContainText('Cadastro')
      const comercial = painel(page).locator('footer').getByRole('button', { name: 'Negociação', exact: true })
      const caixa = (await comercial.boundingBox())!
      expect(caixa.x).toBeGreaterThanOrEqual(0)
      expect(caixa.y).toBeGreaterThanOrEqual(0)
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(width)
      expect(caixa.y + caixa.height).toBeLessThanOrEqual(1000)
      const cadastro = painel(page).locator('[aria-busy=false]')
      const medidas = await cadastro.evaluate(el => ({ altura: el.clientHeight, conteudo: el.scrollHeight }))
      expect(medidas.conteudo).toBeGreaterThan(medidas.altura)
      await cadastro.evaluate(el => { el.scrollTop = el.scrollHeight })
      const depois = (await comercial.boundingBox())!
      expect(depois.y + depois.height).toBeLessThanOrEqual(1000)
      expect(depois.y).toBe(caixa.y)
      await expect(cadastro.getByRole('heading', { name: 'Origem', exact: true })).toBeVisible()
      await page.screenshot({ path: `${pasta}/dados-rodape-${tema}-${width}.png`, animations: 'disabled' })
      await comercial.press('Enter')
      await expect(painel(page).getByRole('tab', { name: 'Próximo passo', exact: true })).toHaveAttribute('aria-selected', 'true')
    })
  }
}
