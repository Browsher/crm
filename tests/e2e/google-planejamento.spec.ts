import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness, comBancoGrupos } from './dados-grupos'
import { GOOGLE_EMPRESA_DEMO, GOOGLE_PEDIDO_DEMO, GOOGLE_PEDIDO_OUTRO, GOOGLE_TOKEN_E2E, reciboGoogleFixture } from './dados-google'
import { criteriosVazios } from '../../src/lib/google/criterios'
import { hojeEmSaoPaulo, semanaDe } from '../../src/features/google/regras'

test.describe.configure({ timeout: 90_000 })

async function entrar(page: Page, apelido: string, gestor = false) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(apelido + '@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(gestor ? '/gestao' : '/meu-dia')
}
test('vendedor salva um novo planejamento semanal e outra semana começa vazia', async ({ page }) => {
  await entrar(page, 'redesigne2e')
  await page.goto('/fila')
  await page.getByRole('link', { name: 'Planejar buscas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Buscas no Google', exact: true })).toBeVisible()
  await expect(page.getByText('Suas buscas, suas empresas', { exact: true }).locator('xpath=ancestor::div[@data-slot="card"]')).toHaveCSS('flex-direction', 'row')
  await page.getByRole('link', { name: 'Próxima semana', exact: true }).click()
  await page.getByRole('button', { name: 'Editar planejamento', exact: true }).click()
  await page.getByRole('textbox', { name: /^Nicho de segunda-feira/ }).fill('Pet shops de teste')
  await page.getByRole('textbox', { name: /^Cidade de segunda-feira/ }).fill('São Paulo')
  await page.getByRole('combobox', { name: /^UF de segunda-feira/ }).selectOption('SP')
  await page.getByRole('textbox', { name: /^Bairro de segunda-feira/ }).fill('Mooca')
  await page.getByRole('button', { name: 'Salvar planejamento', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(/Planejamento salvo|Salvo no CRM/)
  await page.reload()
  await expect(page.getByText('Pet shops de teste', { exact: true })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-6-captures/google-planejamento-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'Próxima semana', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('Não definido')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('combobox', { name: /Tema/ }).selectOption('dark')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Editar planejamento', exact: true }).click()
  await page.getByRole('button', { name: 'Critérios de busca', exact: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-6-captures/google-planejamento-mobile-escuro.png', fullPage: true })
})
test('entregas pessoais não mostram o telefone da empresa repetida ao segundo vendedor', async ({ page }) => {
  await entrar(page, 'googleoutroe2e')
  await page.goto('/fila/google/' + GOOGLE_PEDIDO_OUTRO)
  await expect(page.getByText('Nenhuma empresa liberada nesta entrega', { exact: true })).toBeVisible()
  await expect(page.getByText('11999990601', { exact: true })).toHaveCount(0)
  await page.goto('/fila/google/' + GOOGLE_PEDIDO_DEMO)
  await expect(page.getByText(GOOGLE_EMPRESA_DEMO, { exact: true })).toHaveCount(0)
})
test('gestor vê solicitações, resultados pendentes e as duas ocorrências na ficha', async ({ page }) => {
  await entrar(page, 'gestore2e', true)
  await page.getByRole('link', { name: 'Coletas do Google', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Planejamentos e coletas', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Entregas e utilização', exact: true })).toHaveCSS('font-size', '18px')
  await expect(page.getByRole('heading', { name: 'Entregas e utilização', exact: true })).toHaveCSS('line-height', '26px')
  await expect(page.getByRole('heading', { name: 'Agentes dos vendedores', exact: true })).toHaveCSS('font-size', '16px')
  await expect(page.getByRole('heading', { name: 'Agentes dos vendedores', exact: true })).toHaveCSS('line-height', '24px')
  await expect(page.getByText('Sincronização pendente', { exact: true }).first()).toHaveAttribute('data-slot', 'badge')
  for (const largura of [1920, 1100, 820, 390]) {
    await page.setViewportSize({ width: largura, height: 1000 })
    for (const tema of ['light', 'dark']) {
      await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
      const colisoes = await page.locator('main [data-slot="card"]').evaluateAll(cards => cards.flatMap(card => {
        const elementos = [...card.children].map(el => ({ texto: el.textContent?.slice(0, 50), rect: el.getBoundingClientRect() })).filter(el => el.rect.width > 0 && el.rect.height > 0)
        return elementos.flatMap((a, i) => elementos.slice(i + 1).filter(b => a.rect.left + 1 < b.rect.right && a.rect.right - 1 > b.rect.left && a.rect.top + 1 < b.rect.bottom && a.rect.bottom - 1 > b.rect.top).map(b => [a.texto, b.texto]))
      }))
      expect(colisoes).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: '.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-6-captures/gestor-' + largura + '-' + tema + '.png', animations: 'disabled', fullPage: true })
      await page.getByRole('heading', { name: 'Entregas e utilização', exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: '.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-6-captures/gestor-registros-' + largura + '-' + tema + '.png', animations: 'disabled' })
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-6-captures/google-gestor-desktop.png', fullPage: true })
  await page.goto('/empresas/google/' + GOOGLE_PEDIDO_DEMO)
  await expect(page.getByRole('heading', { name: 'Telefone pendente (fictícia)', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Histórico da coleta', exact: true })).toHaveCSS('font-size', '16px')
  await expect(page.getByRole('heading', { name: 'Histórico da coleta', exact: true })).toHaveCSS('line-height', '24px')
  const empresa = page.getByRole('heading', { name: GOOGLE_EMPRESA_DEMO, exact: true }).locator('xpath=ancestor::div[@data-slot="card"]')
  await empresa.getByRole('link', { name: 'Ver ficha e histórico', exact: true }).click()
  await page.getByRole('tab', { name: 'Histórico', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Histórico de coletas do Google', exact: true })).toBeVisible()
  await expect(page.getByText('Outro vendedor da coleta', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/empresas/google/' + GOOGLE_PEDIDO_DEMO)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-6-captures/google-gestor-mobile.png', fullPage: true })
})
for (const tema of ['light', 'dark']) {
  test(`filtros do gestor Google preservam payload, espaçamento e empilhamento em ${tema}`, async ({ page }) => {
    await entrar(page, 'gestore2e', true)
    const semana = '2026-11-09'
    await page.goto('/empresas/google?semana=' + semana)
    await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
    const vendedor = page.getByRole('combobox', { name: 'Vendedor', exact: true })
    const situacao = page.getByRole('combobox', { name: 'Situação', exact: true })
    const filtros = page.locator('form').filter({ has: vendedor })
    await expect(filtros).toHaveCount(1)
    await expect(vendedor).toHaveAttribute('name', 'vendedor')
    await expect(situacao).toHaveAttribute('name', 'estado')
    const vendedorId = await vendedor.locator('option').filter({ hasText: /^Vendedora de relacionamento comercial com nome extenso$/ }).getAttribute('value')
    expect(vendedorId).toBeTruthy()
    await vendedor.selectOption(vendedorId!)
    await situacao.selectOption('concluido')
    for (const largura of [1920, 820]) {
      await page.setViewportSize({ width: largura, height: 900 })
      for (const campo of [vendedor, situacao]) {
        const distancia = await campo.evaluate(elemento => {
          const select = elemento as HTMLSelectElement
          return select.getBoundingClientRect().top - select.labels![0].getBoundingClientRect().bottom
        })
        expect.soft(distancia, `distância entre rótulo e campo em ${largura}px`).toBe(8)
        await expect(campo).toHaveCSS('min-height', largura <= 820 ? '44px' : '40px')
      }
      if (largura === 820) {
        const caixaVendedor = (await vendedor.boundingBox())!
        const caixaSituacao = (await situacao.boundingBox())!
        expect.soft(caixaSituacao.y).toBeGreaterThan(caixaVendedor.y + caixaVendedor.height)
        expect.soft(caixaSituacao.x).toBe(caixaVendedor.x)
        expect.soft(caixaSituacao.width).toBe(caixaVendedor.width)
      }
      expect(await filtros.evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement)))).toEqual({
        semana, vendedor: vendedorId, estado: 'concluido',
      })
    }
    await filtros.getByRole('button', { name: 'Aplicar filtros', exact: true }).click()
    const parametros = new URL(page.url()).searchParams
    expect(Object.fromEntries(parametros)).toEqual({ semana, vendedor: vendedorId, estado: 'concluido' })
    await expect(vendedor).toHaveValue(vendedorId!)
    await expect(situacao).toHaveValue('concluido')
    await expect(filtros.locator('input[name=semana]')).toHaveValue(semana)
    const proxima = new URL((await page.getByRole('link', { name: 'Próxima semana', exact: true }).getAttribute('href'))!, page.url())
    expect(Object.fromEntries(proxima.searchParams)).toEqual({ semana: '2026-11-16', vendedor: vendedorId, estado: 'concluido' })
  })
}

test('API do agente publica um lote validado e reutiliza o retorno sem nova entrega', async ({ request, page }) => {
  const id = randomUUID()
  const executor = randomUUID()
  const usuario = await criarUsuarioComSenha(bancoGruposDoHarness(), 'vendedor', 'googleapie2e', 'Senha-e2e-2026')
  const dias = semanaDe(hojeEmSaoPaulo())!
  await comBancoGrupos(c => c.query(`INSERT INTO google_planejamento(id,vendedor_id,dia,nicho,bairro,cidade,uf,estado,iniciado_em,snapshot)
    VALUES ($1,$2,$3,'Papelarias API','Centro','São Paulo','SP','coletando',now(),'{}')`, [id, usuario.id, dias[0]]))
  const headers = { Authorization: 'Bearer ' + GOOGLE_TOKEN_E2E }
  expect((await request.post('/api/agente/google', { data: { acao: 'proximo' } })).status()).toBe(401)
  const proximo = await request.post('/api/agente/google', { headers, data: { acao: 'proximo', executor } })
  expect((await proximo.json()).pedido.id).toBe(id)
  expect(await (await request.post('/api/agente/google',{headers,data:{acao:'proximo',executor:randomUUID()}})).json()).toMatchObject({pedido:null,ocupado:true})
  expect((await request.post('/api/agente/google',{headers,data:{acao:'etapa',executor:randomUUID(),pedido:id,estado:'validando'}})).status()).toBe(409)
  expect((await request.post('/api/agente/google', { headers, data: { acao: 'etapa', executor, pedido: id, estado: 'validando' } })).status()).toBe(200)
  const publicacao = { acao: 'entregar', executor, pedido: id, recibo: reciboGoogleFixture(id), empresas: [{ google_place_id: 'api-google-' + id,
    nome_fantasia: 'Papelaria validada API (fictícia)', telefone: '11999990605', validado: true }] }
  const entrega = await request.post('/api/agente/google', { headers, data: publicacao })
  expect(await entrega.json()).toEqual({ resultado: 'ok' })
  expect(await (await request.post('/api/agente/google', { headers, data: publicacao })).json()).toEqual({ resultado: 'repetida' })
  await entrar(page, 'googleapie2e')
  await page.goto('/fila/google/' + id)
  await expect(page.getByRole('heading', { name: 'Papelaria validada API (fictícia)', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Prospectar', exact: true }).click()
  await expect(page).toHaveURL('/fila')
  await expect(page.getByText('Papelaria validada API (fictícia)', { exact: true }).first()).toBeVisible()
})

test('critérios Google mantêm payload e medidas no toque amplo', async ({ browser, request }) => {
  test.setTimeout(150000)
  const banco = bancoGruposDoHarness()
  const usuario = await criarUsuarioComSenha(banco, 'vendedor', 'googletoquee2e', 'Senha-e2e-2026')
  const data = new Date(hojeEmSaoPaulo() + 'T12:00:00Z')
  data.setUTCDate(data.getUTCDate() + 21)
  const dias = semanaDe(data.toISOString().slice(0, 10))!
  const contexto = await browser.newContext({ baseURL: 'http://localhost:3100', hasTouch: true, viewport: { width: 1280, height: 900 } })
  try {
    const page = await contexto.newPage()
    await entrar(page, 'googletoquee2e')
    await page.goto('/fila/google?semana=' + dias[0])
    await page.getByRole('button', { name: 'Editar planejamento', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Planejamento da semana', exact: true })).toHaveCSS('font-size', '18px')
    await expect(page.getByRole('heading', { name: 'Planejamento da semana', exact: true })).toHaveCSS('line-height', '26px')
    await page.getByRole('textbox', { name: /^Nicho de segunda-feira/ }).fill('Lojas do contrato')
    await page.getByRole('textbox', { name: /^Cidade de segunda-feira/ }).fill('Campinas')
    await page.getByRole('combobox', { name: /^UF de segunda-feira/ }).selectOption('SP')
    let gravacoes = 0
    page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/fila/google')) gravacoes++ })
    const linhasAntes = await (await request.get(new URL('/__controle', process.env.GOOGLE_PLANILHA_MOCK_URL!).href)).json()
    for (const tema of ['light', 'dark']) {
      await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
      await page.getByRole('button', { name: 'Critérios de busca', exact: true }).first().click()
      const dialogo = page.getByRole('dialog')
      const campo = dialogo.locator('textarea').first()
      await expect(campo).toHaveCSS('font-size', '16px')
      await expect(campo).toHaveCSS('min-height', '96px')
      await expect(dialogo).toHaveCSS('background-color', tema === 'dark' ? 'rgb(28, 36, 45)' : 'rgb(255, 255, 255)')
      await campo.fill('Descartar este texto')
      await dialogo.getByRole('checkbox', { name: 'Telefone fixo', exact: true }).check()
      await campo.focus()
      await campo.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(campo).toBeFocused()
      await expect(campo).toHaveCSS('outline-width', '3px')
      await expect(campo).toHaveCSS('outline-offset', '3px')
      await expect(campo).toHaveCSS('box-shadow', 'none')
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-6-captures/criterios-toque1280-${tema}.png`, animations: 'disabled' })
      await dialogo.getByRole('button', { name: 'Cancelar', exact: true }).click()
      await expect(page.getByRole('textbox', { name: /^Nicho de segunda-feira/ })).toHaveValue('Lojas do contrato')
    }
    expect(gravacoes).toBe(0)
    expect(await (await request.get(new URL('/__controle', process.env.GOOGLE_PLANILHA_MOCK_URL!).href)).json()).toEqual(linhasAntes)
    await page.getByRole('button', { name: 'Critérios de busca', exact: true }).first().click()
    const dialogo = page.getByRole('dialog')
    const campo = dialogo.getByRole('textbox', { name: 'Termos adicionais', exact: true })
    await expect(campo).toHaveValue('')
    await expect(dialogo.getByRole('checkbox', { name: 'Telefone fixo', exact: true })).not.toBeChecked()
    await campo.fill('Iluminação comercial')
    await dialogo.getByLabel('Produtos de interesse', { exact: true }).fill('Luminárias')
    await dialogo.getByRole('checkbox', { name: 'Varejista', exact: true }).check()
    await dialogo.getByRole('checkbox', { name: 'Telefone fixo', exact: true }).check()
    await dialogo.getByLabel('Nota mínima', { exact: true }).fill('0')
    for (const largura of [1920, 1024, 820, 390]) {
      await page.setViewportSize({ width: largura, height: 1000 })
      for (const tema of ['light', 'dark']) {
        // O shell está sob a sobreposição: o portal acompanha o tema armazenado na próxima abertura.
        await dialogo.getByRole('button', { name: 'Aplicar critérios', exact: true }).click()
        await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
        await page.getByRole('button', { name: 'Critérios de busca', exact: true }).first().click()
        await expect(campo).toHaveValue('Iluminação comercial')
        await expect(campo).toHaveCSS('min-height', '96px')
        await expect(campo).toHaveCSS('font-size', '16px')
        const geometria = await dialogo.evaluate(el => {
          const grupos = [...el.querySelectorAll('fieldset')].filter(g => [...g.children].some(f => f.tagName === 'LEGEND' && f.textContent === 'O que procurar') || [...g.children].some(f => f.tagName === 'LEGEND' && f.textContent === 'O que evitar')).map(g => g.getBoundingClientRect())
          const [a, b] = grupos
          return { sobrepoe: a && b ? a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top : true, largura: el.getBoundingClientRect().width }
        })
        expect(geometria.sobrepoe).toBe(false)
        expect(geometria.largura).toBeLessThanOrEqual(largura)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-6-captures/criterios-${largura}-${tema}.png`, animations: 'disabled' })
      }
    }
    await dialogo.getByRole('button', { name: 'Aplicar critérios', exact: true }).click()
    expect(gravacoes).toBe(0)
    await page.getByRole('button', { name: 'Salvar planejamento', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(/salvo|sincronizado/i)
    expect(gravacoes).toBe(1)
    const [{ criterios }] = await banco.sql<{ criterios: ReturnType<typeof criteriosVazios> }>('SELECT criterios FROM google_planejamento WHERE vendedor_id=$1 AND dia=$2', [usuario.id, dias[0]])
    expect(criterios).toEqual({ ...criteriosVazios(), termos: 'Iluminação comercial', produtos: 'Luminárias', tipos: ['varejista'], telefone: ['fixo'], nota: 0 })
    const planilha = await (await request.get(new URL('/__controle', process.env.GOOGLE_PLANILHA_MOCK_URL!).href)).json()
    const linha = planilha.linhas.find((l: string[]) => l[2] === usuario.id && l[4] === dias[0])
    expect(JSON.parse(linha[13])).toEqual(criterios)
    await page.getByRole('button', { name: 'Ver critérios', exact: true }).first().click()
    await expect(campo).toHaveValue('Iluminação comercial')
    await expect(campo).toBeDisabled()
    await expect(dialogo.getByRole('checkbox', { name: 'Telefone fixo', exact: true })).toBeChecked()
    await expect(dialogo.getByRole('checkbox', { name: 'Telefone fixo', exact: true })).toBeDisabled()
    await expect(dialogo.getByRole('button', { name: 'Aplicar critérios', exact: true })).toHaveCount(0)
    await dialogo.locator('[data-slot="dialog-footer"]').getByRole('button', { name: 'Fechar', exact: true }).click()
  } finally {
    await contexto.close()
  }
})