import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { comoUsuario } from '../../src/server/db/como-usuario'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { vincularEmpresaTeste } from '../integracao/atendimento-fixtures'
import { bancoGruposDoHarness } from './dados-grupos'

const painel = (page: Page) => page.locator('[data-painel-lateral]')
const senha = 'Senha-e2e-2026'
const dimensoes = [[390, 844], [820, 900], [821, 900], [1024, 768], [1440, 900]] as const

async function preparar(page: Page) {
  const banco = bancoGruposDoHarness(), apelido = 'paineis-' + randomUUID().slice(0, 8)
  const eu = await criarUsuarioComSenha(banco, 'vendedor', apelido, senha)
  const id = randomUUID(), nome = 'Empresa ' + apelido
  await banco.sql('INSERT INTO empresa(id,razao_social,telefone) VALUES($1,$2,$3)', [id, nome, '11900000000'])
  const versao = await vincularEmpresaTeste(banco, id, eu.id, 'legado')
  const nota = 'Leitura longa autorizada ' + 'palavramuitolongasemespacos'.repeat(70)
  const r = await comoUsuario(eu.id, e => e<{ r: { ok: boolean } }>(
    "SELECT contato_registrar_direto($1,$2,$3,'interessado',$4,'Retorno preservado','2030-01-01') r", [id, randomUUID(), versao, nota],
  ))
  expect(r.linhas[0].r.ok).toBe(true)
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(apelido + '@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  return { banco, eu, id, nome, nota }
}

async function geometria(page: Page, width: number, height: number) {
  await expect(painel(page)).toHaveCount(1)
  const box = (await painel(page).boundingBox())!
  const limite = width <= 820 ? width : Math.min(520, Math.max(380, width * .47))
  expect(Math.abs(box.width - limite)).toBeLessThanOrEqual(1)
  expect(box.y).toBe(0)
  expect(Math.abs(box.height - height)).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const cabecalho = painel(page).locator(':scope > header'), rodape = painel(page).locator(':scope > footer')
  const antes = (await cabecalho.boundingBox())!
  const base = await rodape.boundingBox()
  expect(antes.y).toBeGreaterThanOrEqual(0)
  if (base) expect(base.y + base.height).toBeLessThanOrEqual(height)
  await painel(page).locator('[data-painel-corpo]').evaluate(el => { el.scrollTop = el.scrollHeight })
  const cabecalhoDepois = (await cabecalho.boundingBox())!, rodapeDepois = await rodape.boundingBox()
  expect(cabecalhoDepois.y).toBe(antes.y)
  if (base) expect(rodapeDepois!.y).toBe(base.y)
  await test.info().attach('geometria-' + await painel(page).getAttribute('aria-label'), {
    body: JSON.stringify({ viewport: { width, height }, painel: box, cabecalho: antes, cabecalhoDepois, rodape: base, rodapeDepois }),
    contentType: 'application/json',
  })
  expect(await painel(page).locator('[data-painel-corpo]').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  for (const botao of await painel(page).locator(':scope > header button, :scope > footer button, :scope > footer a').all()) {
    expect((await botao.boundingBox())!.height).toBeGreaterThanOrEqual(width <= 820 ? 44 : 40)
  }
}

for (const tema of ['light', 'dark']) for (const [width, height] of dimensoes) {
  test(`quatro consumidores, leitura longa e geometria ${tema} ${width}x${height}`, async ({ page }) => {
    const { nome, nota } = await preparar(page)
    await page.getByRole('combobox', { name: 'Tema do Meu dia' }).selectOption(tema)
    await page.setViewportSize({ width, height })
    const card = page.getByTestId('lista-meu-dia').getByRole('listitem').filter({ has: page.locator('strong', { hasText: nome }) })
    const abrir = card.getByRole('button', { name: 'Abrir retorno', exact: true })
    await abrir.press('Enter')
    await geometria(page, width, height)
    await painel(page).getByRole('button', { name: 'Histórico', exact: true }).press('Enter')
    await painel(page).getByRole('button', { name: 'Expandir todos', exact: true }).click()
    await expect(painel(page).getByText(nota, { exact: true })).toBeVisible()
    await geometria(page, width, height)
    await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(painel(page).getByRole('button', { name: 'Histórico', exact: true })).toBeFocused()
    await painel(page).getByRole('button', { name: 'Dados da empresa', exact: true }).click()
    await expect(painel(page)).toContainText('Cadastro')
    await geometria(page, width, height)
    await painel(page).getByRole('button', { name: 'Negociação', exact: true }).press('Enter')
    await painel(page).getByRole('button', { name: 'Atendimento e próximo passo', exact: true }).click()
    await geometria(page, width, height)
    const venda = (await painel(page).getByRole('button', { name: 'Registrar venda', exact: true }).boundingBox())!
    const arquivo = (await painel(page).getByRole('button', { name: 'Sem interesse', exact: true }).boundingBox())!
    expect(Math.abs(venda.width - arquivo.width)).toBeLessThanOrEqual(1)
    if (width <= 820) {
      await painel(page).getByRole('button', { name: 'Sem interesse', exact: true }).focus()
      await page.keyboard.press('Tab')
      await expect(painel(page).locator('header button')).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(painel(page).getByRole('button', { name: 'Sem interesse', exact: true })).toBeFocused()
    } else {
      await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0)
      await page.getByRole('navigation', { name: 'Navegação do CRM' }).getByRole('link', { name: 'Funil', exact: true }).focus()
      await expect(page.getByRole('navigation', { name: 'Navegação do CRM' }).getByRole('link', { name: 'Funil', exact: true })).toBeFocused()
    }
    await painel(page).getByRole('button', { name: 'Sem interesse', exact: true }).click()
    const confirmar = page.getByRole('dialog', { name: 'Marcar como Sem interesse?', exact: true })
    await expect(confirmar).toContainText(nome)
    expect(await confirmar.evaluate(el => !el.closest('[inert]'))).toBe(true)
    await confirmar.getByRole('button', { name: 'Confirmar Sem interesse', exact: true }).press('Enter')
    await expect(painel(page)).toHaveCount(0)
    await page.goto('/funil')
    await page.getByRole('button', { name: 'Sem interesse', exact: true }).click()
    await expect(painel(page)).toContainText(nome)
    await geometria(page, width, height)
    await page.screenshot({ path: `test-results/paineis-${tema}-${width}.png`, animations: 'disabled' })
    const devolver = painel(page).getByRole('button', { name: 'Devolver ' + nome + ' para Primeiro contato', exact: true })
    await devolver.click()
    await expect(devolver).toHaveCount(0)
    await expect(painel(page).getByRole('heading', { name: 'Sem interesse', exact: true })).toBeFocused()
    await expect(painel(page).locator('[data-tipo=sucesso]')).toContainText(nome)
    await expect(painel(page).locator('[data-tipo=sucesso]')).toContainText('Empresa devolvida para Primeiro contato')
    await expect(page.locator('article[draggable]').filter({ hasText: nome })).toHaveCount(1)
  })
}

test('820/821 mantém nota, campos, promessa e uma única gravação durante envio lento', async ({ page }) => {
  const { banco, id } = await preparar(page)
  await page.setViewportSize({ width: 821, height: 900 })
  await page.getByRole('button', { name: 'Abrir retorno', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Negociação', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Atendimento e próximo passo', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Registrar atendimento', exact: true }).click()
  const nota = painel(page).getByLabel('Nota', { exact: true })
  await nota.fill('Nota permanece no limiar')
  await painel(page).getByRole('textbox', { name: 'Próximo passo', exact: true }).fill('Retomar após o limiar')
  await painel(page).getByLabel('Data do próximo passo', { exact: true }).fill('2030-01-02')
  await nota.evaluate(el => { el.setAttribute('data-identidade-aceitacao', 'original') })
  await page.setViewportSize({ width: 820, height: 900 })
  await expect(nota).toHaveValue('Nota permanece no limiar')
  await expect(nota).toHaveAttribute('data-identidade-aceitacao', 'original')
  let liberar!: () => void, recebeu!: () => void
  const liberado = new Promise<void>(r => { liberar = r }), recebido = new Promise<void>(r => { recebeu = r })
  const envios: string[] = []
  await page.route('**/meu-dia*', async rota => {
    const corpo = rota.request().postData() ?? ''
    if (rota.request().method() !== 'POST' || !corpo.includes('Nota permanece no limiar')) return rota.continue()
    envios.push(corpo)
    const resposta = await rota.fetch()
    recebeu()
    await liberado
    await rota.fulfill({ response: resposta })
  })
  await painel(page).getByRole('button', { name: 'Salvar atendimento', exact: true }).click()
  await recebido
  try {
    await page.setViewportSize({ width: 821, height: 900 })
    await expect(nota).toHaveValue('Nota permanece no limiar')
    await expect(nota).toHaveAttribute('data-identidade-aceitacao', 'original')
    await expect(painel(page).getByRole('textbox', { name: 'Próximo passo', exact: true })).toHaveValue('Retomar após o limiar')
    const estado = await painel(page).evaluate(el => ({
      ocupado: el.querySelector('[data-painel-corpo]')?.getAttribute('aria-busy'),
      fechamentoDesabilitado: el.querySelector<HTMLButtonElement>('header button')?.disabled,
      acoes: [...el.querySelectorAll<HTMLButtonElement>('footer button')].map(b => ({ texto: b.textContent, desabilitado: b.disabled })),
    }))
    await test.info().attach('estado-pendente-820-821', { body: JSON.stringify(estado), contentType: 'application/json' })
    await painel(page).locator('header button').evaluate((el: HTMLButtonElement) => el.click())
    await expect(nota).toHaveValue('Nota permanece no limiar')
    await expect(page.getByRole('dialog', { name: 'Descartar alterações?', exact: true })).toHaveCount(0)
    await expect(painel(page).locator('header button')).toBeDisabled()
    await painel(page).press('Escape')
    await expect(painel(page)).toHaveCount(1)
    expect(envios).toHaveLength(1)
  } finally { liberar() }
  await expect(painel(page)).toHaveCount(0)
  expect(await banco.sql('SELECT nota FROM contato WHERE empresa_id=$1 AND nota=$2', [id, 'Nota permanece no limiar'])).toEqual([{ nota: 'Nota permanece no limiar' }])
  expect(envios).toHaveLength(1)
})

test('devolução móvel perdida mantém recuperação visível e repete a chave sem duplicar', async ({ page }) => {
  const { banco, eu, id, nome } = await preparar(page)
  const [alvo] = await banco.sql<{ negociacao: string; versao: number }>('SELECT n.id negociacao,v.versao FROM negociacao n JOIN empresa_vinculo v ON v.empresa_id=n.empresa_id WHERE n.empresa_id=$1 AND n.encerrada_em IS NULL', [id])
  const r = await comoUsuario(eu.id, e => e<{ r: { ok: boolean } }>('SELECT empresa_sem_interesse_definir($1,$2,$3,$4) r', [id, randomUUID(), alvo.versao, alvo.negociacao]))
  expect(r.linhas[0].r.ok).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/funil')
  await page.getByRole('button', { name: 'Sem interesse', exact: true }).click()
  const envios: string[] = []
  await page.route('**/funil*', async rota => {
    const corpo = rota.request().postData() ?? ''
    if (rota.request().method() !== 'POST' || !corpo.includes(id)) return rota.continue()
    envios.push(corpo)
    if (envios.length > 1) return rota.continue()
    const resposta = await rota.fetch()
    expect(resposta.ok()).toBe(true)
    await rota.abort('failed')
  })
  await painel(page).getByRole('button', { name: 'Devolver ' + nome + ' para Primeiro contato', exact: true }).press('Enter')
  const recuperacao = painel(page).getByRole('region', { name: 'Devolução pendente', exact: true })
  await expect(recuperacao).toBeVisible()
  await expect(recuperacao).toContainText(nome)
  const confirmar = recuperacao.getByRole('button', { name: 'Confirmar devolução anterior', exact: true })
  await expect(confirmar).toBeEnabled()
  const storage = 'crm:funil:devolver:v1:' + eu.id
  const salvo = await page.evaluate(chave => sessionStorage.getItem(chave), storage)
  expect(salvo).not.toBeNull()
  const comando = JSON.parse(salvo!)
  const antes = await banco.sql('SELECT versao,agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id=$1', [id])
  const incerto = painel(page).locator('[data-tipo=incerto][role=status]')
  await expect(incerto).toBeVisible()
  await expect(incerto).toContainText(nome)
  await expect(incerto).toContainText('Não foi possível confirmar o resultado')
  await expect(page.locator('[role=status]').filter({ hasText: 'Não foi possível confirmar o resultado' })).toHaveCount(1)
  const erro = await incerto.evaluate(el => ({ texto: el.textContent, inert: !!el.closest('[inert]') }))
  expect(erro.inert).toBe(false)
  await confirmar.press('Enter')
  await expect(recuperacao).toHaveCount(0)
  await expect(painel(page).getByRole('heading', { name: 'Sem interesse', exact: true })).toBeFocused()
  const confirmado = painel(page).locator('[data-tipo=sucesso][role=status]')
  await expect(confirmado).toBeVisible()
  await expect(confirmado).toContainText(nome)
  await expect(confirmado).toContainText('Devolução anterior confirmada')
  await expect(page.locator('[role=status]').filter({ hasText: 'Devolução anterior confirmada' })).toHaveCount(1)
  const sucesso = await confirmado.evaluate(el => ({ texto: el.textContent, inert: !!el.closest('[inert]') }))
  expect(sucesso.inert).toBe(false)
  await test.info().attach('feedback-devolucao-movel', { body: JSON.stringify({ erro, sucesso }), contentType: 'application/json' })
  expect(envios).toHaveLength(2)
  for (const corpo of envios) expect(corpo).toContain(comando.chave)
  expect(await banco.sql('SELECT versao,agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id=$1', [id])).toEqual(antes)
  expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [id])).toHaveLength(1)
  expect(await page.evaluate(chave => sessionStorage.getItem(chave), storage)).toBeNull()
})

for (const falha of ['armazenamento', 'recusa'] as const) test(`devolução móvel explica ${falha} sem comando recuperável`, async ({ page }) => {
  const { banco, eu, id, nome } = await preparar(page)
  const [alvo] = await banco.sql<{ negociacao: string; versao: number }>('SELECT n.id negociacao,v.versao FROM negociacao n JOIN empresa_vinculo v ON v.empresa_id=n.empresa_id WHERE n.empresa_id=$1 AND n.encerrada_em IS NULL', [id])
  const r = await comoUsuario(eu.id, e => e<{ r: { ok: boolean } }>('SELECT empresa_sem_interesse_definir($1,$2,$3,$4) r', [id, randomUUID(), alvo.versao, alvo.negociacao]))
  expect(r.linhas[0].r.ok).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/funil')
  await page.getByRole('button', { name: 'Sem interesse', exact: true }).click()
  await expect(painel(page)).toContainText(nome)
  if (falha === 'armazenamento') await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (chave, valor) {
      if (chave.startsWith('crm:funil:devolver:v1:')) throw Error('quota sintética')
      original.call(this, chave, valor)
    }
  })
  else await banco.sql('UPDATE empresa_vinculo SET versao=versao+1 WHERE empresa_id=$1', [id])
  let envios = 0
  page.on('request', pedido => { if (pedido.method() === 'POST' && pedido.url().includes('/funil') && pedido.postData()?.includes(id)) envios++ })
  await painel(page).getByRole('button', { name: 'Devolver ' + nome + ' para Primeiro contato', exact: true }).click()
  const erro = painel(page).locator('[data-tipo=erro][role=alert]')
  await expect(erro).toBeVisible()
  await expect(erro).toContainText(nome)
  await expect(erro).toContainText(falha === 'armazenamento' ? 'Nenhum envio foi feito' : 'O arquivo desta empresa mudou')
  await expect(page.locator('[role=alert]').filter({ hasText: nome })).toHaveCount(1)
  expect(await erro.evaluate(el => !!el.closest('[inert]'))).toBe(false)
  await expect(painel(page).getByRole('region', { name: 'Devolução pendente', exact: true })).toHaveCount(0)
  await expect(painel(page).getByRole('heading', { name: 'Sem interesse', exact: true })).toBeFocused()
  expect(await page.evaluate(chave => sessionStorage.getItem(chave), 'crm:funil:devolver:v1:' + eu.id)).toBeNull()
  expect(envios).toBe(falha === 'armazenamento' ? 0 : 1)
  expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [id])).toHaveLength(0)
  await test.info().attach('feedback-' + falha, { body: await erro.textContent() ?? '', contentType: 'text/plain' })
})

test.describe('toque emulado', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })
  test('abre tarefa e confirmação central com o mesmo alvo', async ({ page }) => {
    const { nome } = await preparar(page)
    await page.getByRole('button', { name: 'Abrir retorno', exact: true }).tap()
    await painel(page).getByRole('button', { name: 'Negociação', exact: true }).tap()
    await painel(page).getByRole('button', { name: 'Atendimento e próximo passo', exact: true }).tap()
    await painel(page).getByRole('button', { name: 'Sem interesse', exact: true }).tap()
    const confirmar = page.getByRole('dialog', { name: 'Marcar como Sem interesse?', exact: true })
    await expect(confirmar).toContainText(nome)
    await confirmar.getByRole('button', { name: 'Cancelar', exact: true }).tap()
    await expect(confirmar).toHaveCount(0)
    await expect(painel(page).getByRole('heading', { name: nome, exact: true })).toBeVisible()
  })
})
