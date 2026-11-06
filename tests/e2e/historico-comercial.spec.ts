import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { comoUsuario } from '../../src/server/db/como-usuario'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { vincularEmpresaTeste } from '../integracao/atendimento-fixtures'
import { bancoGruposDoHarness } from './dados-grupos'

const banco = () => bancoGruposDoHarness()
const painel = (page: Page) => page.locator('[data-painel-lateral]')
const card = (page: Page, nome: string) => page.getByTestId('lista-meu-dia').getByRole('listitem').filter({ has: page.locator('strong', { hasText: nome }) })
const pasta = 'docs/design/2026-11-05-meu-dia'
const senha = 'Senha-e2e-2026'

async function cenario() {
  const apelido = 'historico-' + randomUUID().slice(0, 8)
  const usuario = await criarUsuarioComSenha(banco(), 'vendedor', apelido, senha, { pendente: false })
  const empresas = []
  for (const letra of ['A', 'B']) {
    const id = randomUUID(), nome = `Histórico ${letra} ${apelido}`
    await banco().sql('INSERT INTO empresa(id,razao_social,telefone) VALUES($1,$2,$3)', [id, nome, '11900000600'])
    const versao = await vincularEmpresaTeste(banco(), id, usuario.id, 'legado')
    const [{ data }] = await banco().sql<{ data: string }>(`SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM-DD') data`)
    const r = await comoUsuario(usuario.id, e => e<{ r: { ok: boolean } }>(`SELECT contato_registrar_direto($1,$2,$3,'interessado',$4,'Retornar hoje',$5) r`, [id, randomUUID(), versao, 'Nota autorizada ' + letra, data]))
    expect(r.linhas[0].r.ok).toBe(true)
    const [negociacao] = await banco().sql<{ id: string }>('SELECT id FROM negociacao WHERE empresa_id=$1', [id])
    empresas.push({ id, nome, negociacao: negociacao.id })
  }
  return { usuario, email: apelido + '@teste.local', empresas }
}
async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
}
async function abrirNegociacao(page: Page, nome: string) {
  await card(page, nome).getByRole('button', { name: 'Abrir retorno', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Negociação', exact: true }).click()
  await expect(painel(page).getByRole('button', { name: 'Atendimento e próximo passo', exact: true })).toBeVisible()
}

test('histórico preserva nota longa, autoria ausente, atividade e data da venda; expansão é por filtro e teclado', async ({ page }) => {
  const { empresas: [a], usuario, email } = await cenario()
  const nota = 'Nota longa autorizada. '.repeat(75).trim()
  await banco().sql(`WITH ator AS MATERIALIZED (SELECT set_config('app.usuario_id',$2,true)) INSERT INTO contato(empresa_id,tipo,nota) SELECT $1,'nao_liguei',$3 FROM ator`, [a.id, usuario.id, nota])
  await banco().sql(`INSERT INTO contato(empresa_id,tipo,nota) VALUES($1,'nao_atendeu',NULL)`, [a.id])
  const venda = await comoUsuario(usuario.id, e => e<{ r: string }>(`SELECT funil_venda_registrar($1,$2,'2020-01-02',12050,'Venda com data histórica') r`, [a.negociacao, randomUUID()]))
  expect(venda.linhas[0].r).toBe('ok')
  await entrar(page, email)
  await page.goto('/carteira/' + a.id)
  await page.getByRole('tab', { name: 'Histórico', exact: true }).click()
  const historico = page.getByRole('region', { name: 'Histórico comercial', exact: true })
  await expect(historico.locator('details')).toHaveCount(4)
  await expect(historico.locator('details[open]')).toHaveCount(0)
  await expect(historico.getByText('Autor não informado', { exact: true })).toBeVisible()
  const atividade = historico.locator('details').filter({ has: page.locator('summary', { hasText: 'Atividade sem ligação' }) })
  await atividade.locator('summary').focus()
  await atividade.locator('summary').press('Enter')
  await expect(atividade.getByText(nota, { exact: true })).toBeVisible()
  await historico.getByRole('button', { name: /^Vendas/ }).click()
  await expect(historico.locator('details')).toHaveCount(1)
  await historico.getByRole('button', { name: 'Expandir todos', exact: true }).click()
  await expect(historico.getByText('· Data da venda: 02/01/2020', { exact: false })).toBeVisible()
  await expect(historico.getByText('Venda com data histórica', { exact: true })).toBeVisible()
  expect((await historico.locator('summary time').getAttribute('datetime'))!.slice(0, 10)).not.toBe('2020-01-02')
  await historico.getByRole('button', { name: /^Atendimentos/ }).click()
  await expect(historico.locator('details')).toHaveCount(3)
  await expect(historico.locator('details[open]')).toHaveCount(1)
  for (const tema of ['light', 'dark']) {
    await page.getByRole('combobox').selectOption(tema)
    await historico.getByRole('button', { name: 'Expandir todos', exact: true }).click()
    await expect(historico.locator('details[open]')).toHaveCount(3)
    await expect(historico.getByText('Sem anotação.', { exact: true })).toBeVisible()
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `${pasta}/historico-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })
    }
    await historico.getByRole('button', { name: 'Recolher todos', exact: true }).click()
    await expect(historico.locator('details[open]')).toHaveCount(0)
  }
})

test('erro permite retry e A para B para A descarta resposta lenta e expansão antiga', async ({ page }) => {
  const { empresas: [a, b], email } = await cenario()
  await entrar(page, email)
  await page.setViewportSize({ width: 1440, height: 900 })
  let falhar = true, bloquearB = false, liberar!: () => void, avisarB!: () => void
  const liberado = new Promise<void>(r => { liberar = r })
  const recebidoB = new Promise<void>(r => { avisarB = r })
  await page.route('**/meu-dia*', async rota => {
    if (rota.request().method() !== 'POST') return rota.continue()
    const corpo = rota.request().postData() ?? ''
    if (corpo.includes(a.id) && falhar) { falhar = false; return rota.abort('failed') }
    if (corpo.includes(b.id) && bloquearB) {
      const resposta = await rota.fetch()
      avisarB()
      await liberado
      return rota.fulfill({ response: resposta })
    }
    return rota.continue()
  })
  await card(page, a.nome).getByRole('button', { name: 'Abrir retorno' }).click()
  await painel(page).getByRole('button', { name: 'Histórico', exact: true }).click()
  await expect(painel(page).getByRole('alert').getByRole('heading')).toHaveText('Não foi possível carregar o histórico.')
  await painel(page).getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Expandir todos', exact: true }).click()
  await expect(painel(page).getByText('Nota autorizada A', { exact: true })).toBeVisible()
  bloquearB = true
  await card(page, b.nome).getByRole('button', { name: 'Abrir retorno' }).click()
  await painel(page).getByRole('button', { name: 'Histórico', exact: true }).click()
  await recebidoB
  await expect(painel(page).getByRole('status').getByRole('heading')).toHaveText('Carregando histórico')
  await expect(painel(page)).not.toContainText('Nota autorizada A')
  await card(page, a.nome).getByRole('button', { name: 'Abrir retorno' }).click()
  await painel(page).getByRole('button', { name: 'Histórico', exact: true }).click()
  liberar()
  await expect(painel(page).locator('details')).toHaveCount(1)
  await expect(painel(page).locator('details[open]')).toHaveCount(0)
  await painel(page).getByRole('button', { name: 'Expandir todos', exact: true }).click()
  await expect(painel(page).getByText('Nota autorizada A', { exact: true })).toBeVisible()
  await expect(painel(page)).not.toContainText('Nota autorizada B')
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Negociação', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Histórico', exact: true }).click()
  await painel(page).getByRole('button', { name: /^Vendas/ }).click()
  await expect(painel(page).getByText('Nenhum registro neste filtro', { exact: true })).toBeVisible()
  await expect(painel(page).getByRole('button', { name: 'Expandir todos', exact: true })).toBeDisabled()
})

test('rascunho no editor protege filtros, pesquisa Enter, navegação, Sair, Back e beforeunload', async ({ page }) => {
  const { empresas: [a], email } = await cenario()
  await entrar(page, email)
  await abrirNegociacao(page, a.nome)
  await painel(page).getByRole('button', { name: 'Atendimento e próximo passo', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Registrar atendimento', exact: true }).click()
  await painel(page).getByLabel('Nota', { exact: true }).fill('Rascunho que não pode sumir')
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  const descartar = page.getByRole('dialog', { name: 'Descartar alterações?', exact: true })
  const manter = async () => {
    await expect(descartar).toBeVisible()
    await descartar.getByRole('button', { name: 'Continuar editando', exact: true }).click()
    await expect(page).toHaveURL('/meu-dia')
  }
  await manter()
  await page.getByRole('group', { name: 'Filtrar retornos' }).getByRole('button', { name: 'Hoje', exact: true }).click()
  await manter()
  await page.getByLabel('Nome', { exact: true }).fill('Outro filtro')
  await page.getByLabel('Nome', { exact: true }).press('Enter')
  await manter()
  await page.evaluate(() => history.back())
  await manter()
  let tipoDialogo = ''
  page.once('dialog', async dialogo => { tipoDialogo = dialogo.type(); await dialogo.dismiss() })
  await page.close({ runBeforeUnload: true })
  await expect.poll(() => tipoDialogo).toBe('beforeunload')
  await expect(painel(page)).toBeVisible()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await manter()
  await page.getByRole('navigation', { name: 'Navegação do CRM' }).getByRole('link', { name: 'Carteira', exact: true }).click()
  await manter()
  await expect(painel(page).getByLabel('Nota', { exact: true })).toHaveValue('Rascunho que não pode sumir')
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  await descartar.getByRole('button', { name: 'Descartar', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Fechar', exact: true }).click()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL('/login')
})

test('primeira venda iniciada no Meu dia abre a ficha correta da Carteira', async ({ page }) => {
  const { empresas: [a], email } = await cenario()
  await entrar(page, email)
  await abrirNegociacao(page, a.nome)
  await painel(page).getByRole('button', { name: 'Atendimento e próximo passo', exact: true }).click()
  await abrirLeitura(page)
  await painel(page).getByRole('button', { name: 'Registrar venda', exact: true }).click()
  await painel(page).getByLabel('Valor em reais').fill('101,50')
  await painel(page).getByLabel('Data da venda').fill('2026-01-02')
  await painel(page).getByRole('button', { name: 'Conferir venda', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar venda', exact: true }).click()
  await expect(page).toHaveURL(`/carteira/${a.id}?venda=registrada`)
  await expect(page.getByRole('heading', { name: a.nome, exact: true })).toBeVisible()
  expect(await banco().sql('SELECT valor_centavos::int valor FROM venda WHERE empresa_id=$1', [a.id])).toEqual([{ valor: 10150 }])
})

test('arquivo perde resposta após commit, recarrega e confirma a mesma chave no outro consumidor sem duplicar', async ({ page }) => {
  const { empresas: [a], usuario, email } = await cenario()
  await entrar(page, email)
  await abrirNegociacao(page, a.nome)
  const envios: string[] = []
  await page.route('**/meu-dia*', async rota => {
    const corpo = rota.request().postData() ?? ''
    if (rota.request().method() !== 'POST' || !corpo.includes('empresaId') || !corpo.includes(a.id)) return rota.continue()
    envios.push(corpo)
    if (envios.length > 1) return rota.continue()
    const resposta = await rota.fetch()
    expect(resposta.ok()).toBe(true)
    await rota.abort('failed')
  })
  await abrirLeitura(page)
  await painel(page).getByRole('button', { name: 'Sem interesse', exact: true }).click()
  await page.locator('[data-slot="dialog-content"]').getByRole('button', { name: 'Confirmar Sem interesse', exact: true }).click()
  const recuperar = page.getByRole('button', { name: 'Confirmar arquivamento anterior', exact: true })
  await expect(recuperar).toBeEnabled()
  await expect(page.getByRole('status')).toContainText('Não foi possível confirmar')
  const storage = 'crm:funil:arquivo:v1:' + usuario.id
  const salvo = await page.evaluate(chave => sessionStorage.getItem(chave), storage)
  expect(salvo).not.toBeNull()
  const comando = JSON.parse(salvo!)
  const antes = await banco().sql(`SELECT arquivada_em::text,agenda_contato_id,versao FROM empresa_vinculo WHERE empresa_id=$1`, [a.id])
  expect(antes[0]).toMatchObject({ agenda_contato_id: null, arquivada_em: expect.any(String) })
  await page.reload()
  expect(await page.evaluate(chave => sessionStorage.getItem(chave), storage)).toBe(salvo)
  await page.goto('/funil')
  const corpos: string[] = []
  page.on('request', r => { if (r.method() === 'POST') corpos.push(r.postData() ?? '') })
  await page.getByRole('button', { name: 'Confirmar envio anterior', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Confirmar envio anterior', exact: true })).toHaveCount(0)
  expect(envios).toHaveLength(1)
  expect(corpos.some(c => c.includes(comando.chave))).toBe(true)
  expect(await banco().sql(`SELECT arquivada_em::text,agenda_contato_id,versao FROM empresa_vinculo WHERE empresa_id=$1`, [a.id])).toEqual(antes)
  expect(await banco().sql(`SELECT chave,operacao FROM empresa_atendimento_operacao WHERE empresa_id=$1 AND operacao='arquivar'`, [a.id])).toEqual([{ chave: comando.chave, operacao: 'arquivar' }])
  expect(await banco().sql(`SELECT encerramento FROM negociacao WHERE empresa_id=$1`, [a.id])).toEqual([{ encerramento: 'sem_interesse' }])
  await page.goto('/meu-dia')
  await expect(card(page, a.nome)).toHaveCount(0)
  await expect(painel(page)).toHaveCount(0)
})

for (const contexto of ['negociacao-b', 'dados-cliente'] as const) {
test(`venda perdida confirma a mesma chave após reload; replay externo protege Back, links e beforeunload em ${contexto}`, async ({ page }) => {
  const { empresas: [a, b], usuario, email } = await cenario()
  await entrar(page, email)
  await abrirNegociacao(page, a.nome)
  const envios: string[] = []
  let liberar!: () => void, confirmarRecebido!: () => void
  const liberado = new Promise<void>(r => { liberar = r })
  const recebido = new Promise<void>(r => { confirmarRecebido = r })
  await page.route('**/meu-dia*', async rota => {
    const corpo = rota.request().postData() ?? ''
    if (rota.request().method() !== 'POST' || !corpo.includes('97,31')) return rota.continue()
    envios.push(corpo)
    const resposta = await rota.fetch()
    expect(resposta.ok()).toBe(true)
    if (envios.length === 1) return rota.abort('failed')
    confirmarRecebido()
    await liberado
    return rota.fulfill({ response: resposta })
  })
  await abrirLeitura(page)
  await painel(page).getByRole('button', { name: 'Registrar venda', exact: true }).click()
  await painel(page).getByLabel('Valor em reais').fill('97,31')
  await painel(page).getByLabel('Data da venda').fill('2026-01-03')
  await painel(page).getByRole('button', { name: 'Conferir venda', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar venda', exact: true }).click()
  await expect(painel(page).getByRole('alert')).toContainText('Não foi possível confirmar')
  const storage = 'crm:venda:v1:' + usuario.id
  const salvo = await page.evaluate(chave => sessionStorage.getItem(chave), storage)
  expect(salvo).not.toBeNull()
  const comando = JSON.parse(salvo!)
  expect(await banco().sql('SELECT chave,valor_centavos::int valor FROM venda WHERE empresa_id=$1', [a.id])).toEqual([{ chave: comando.chave, valor: 9731 }])
  page.once('dialog', dialogo => dialogo.accept())
  await page.reload()
  expect(await page.evaluate(chave => sessionStorage.getItem(chave), storage)).toBe(salvo)
  if (contexto === 'negociacao-b') await abrirNegociacao(page, b.nome)
  else await card(page, a.nome).getByRole('button', { name: 'Dados da empresa', exact: true }).click()
  const titulo = contexto === 'negociacao-b' ? b.nome : 'Dados da empresa'
  await page.getByRole('region', { name: 'Envios anteriores', exact: true }).getByRole('button', { name: 'Confirmar venda anterior', exact: true }).click()
  await recebido
  try {
    if (contexto === 'dados-cliente') {
      const atendimento = painel(page).locator('footer').getByRole('link', { name: 'Atendimento', exact: true })
      await atendimento.click()
      await expect(page).toHaveURL('/meu-dia')
      await atendimento.press('Enter')
      await expect(page).toHaveURL('/meu-dia')
      await expect(painel(page).getByRole('heading', { name: titulo, exact: true })).toBeVisible()
    }
    await page.evaluate(() => history.back())
    await expect(page).toHaveURL('/meu-dia')
    await expect(painel(page).getByRole('heading', { name: titulo, exact: true })).toBeVisible()
    let tipo = ''
    page.once('dialog', async dialogo => { tipo = dialogo.type(); await dialogo.dismiss() })
    await page.close({ runBeforeUnload: true })
    await expect.poll(() => tipo).toBe('beforeunload')
    expect(await page.evaluate(chave => sessionStorage.getItem(chave), storage)).toBe(salvo)
  } finally { liberar() }
  await expect(page.getByRole('region', { name: 'Envios anteriores', exact: true }).getByRole('button', { name: 'Confirmar venda anterior', exact: true })).toHaveCount(0)
  if (contexto === 'negociacao-b') await expect(painel(page).getByRole('heading', { name: titulo, exact: true })).toBeVisible()
  else {
    await expect(painel(page)).toHaveCount(0)
    await expect(page.getByText('Nenhum retorno selecionado', { exact: true })).toBeVisible()
  }
  expect(envios).toHaveLength(2)
  for (const corpo of envios) expect(corpo).toContain(comando.chave)
  expect(await banco().sql('SELECT chave,valor_centavos::int valor FROM venda WHERE empresa_id=$1', [a.id])).toEqual([{ chave: comando.chave, valor: 9731 }])
  await page.screenshot({ path: `${pasta}/${contexto === 'negociacao-b' ? 'replay-venda-empresa-b' : 'replay-venda-dados-cliente'}.png`, fullPage: true })
})
}

test('sucesso de arquivo revalida as duas rotas e navegação com remontagem conserva a agenda cancelada', async ({ page }) => {
  const { empresas: [a], usuario, email } = await cenario()
  await entrar(page, email)
  // Preenche o cache real de navegação do Funil antes do comando.
  await page.getByRole('navigation', { name: 'Navegação do CRM' }).getByRole('link', { name: 'Funil', exact: true }).click()
  await expect(page.getByRole('heading', { name: a.nome, exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Navegação do CRM' }).getByRole('link', { name: 'Meu dia', exact: true }).click()
  await abrirNegociacao(page, a.nome)
  await painel(page).getByRole('button', { name: 'Atendimento e próximo passo', exact: true }).click()
  await abrirLeitura(page)
  await painel(page).getByRole('button', { name: 'Sem interesse', exact: true }).click()
  await page.locator('[data-slot="dialog-content"]').getByRole('button', { name: 'Confirmar Sem interesse', exact: true }).click()
  await expect(card(page, a.nome)).toHaveCount(0)
  await expect(painel(page)).toHaveCount(0)
  expect(await page.evaluate(id => sessionStorage.getItem('crm:funil:arquivo:v1:' + id), usuario.id)).toBeNull()
  await page.getByRole('navigation', { name: 'Navegação do CRM' }).getByRole('link', { name: 'Funil', exact: true }).click()
  await expect(page.locator('article[draggable]').filter({ has: page.getByRole('heading', { name: a.nome, exact: true }) })).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Navegação do CRM' }).getByRole('link', { name: 'Meu dia', exact: true }).click()
  await expect(card(page, a.nome)).toHaveCount(0)
  await expect(painel(page)).toHaveCount(0)
  expect(await banco().sql('SELECT agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [a.id])).toEqual([{ agenda_contato_id: null }])
})

async function abrirLeitura(page: import('@playwright/test').Page) {
  const lateral = page.locator('[data-painel-lateral]')
  if (new URL(page.url()).pathname.startsWith('/carteira/')) return
  await expect(lateral).toBeVisible()
  await expect(lateral.locator('[data-painel-corpo]')).toHaveAttribute('aria-busy', 'false')
  const menu = lateral.getByRole('button', { name: 'Atendimento e próximo passo', exact: true })
  if (await menu.isVisible()) await menu.click()
}
