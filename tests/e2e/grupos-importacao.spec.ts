import { expect, test, type Page } from '@playwright/test'
import { formatarCnpj } from '../../src/lib/empresa-visual'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness, comBancoGrupos, criarListaHistorica, prepararGrupos, GRUPOS, CNPJ_JORNADA_NOVA, CNPJ_JORNADA_OVERLAP, CNPJ_JORNADA_CARTEIRA } from './dados-grupos'

const NOVA = 'Jornada Grupos Nova fictícia'
const OVERLAP = 'Jornada Grupos Compartilhada fictícia'
const CARTEIRA = 'Jornada Grupos Carteira fictícia'
const NOME = 'Mooca | Jornada de prospecção fictícia'
const RENOMEADO = 'Jornada renomeada'

async function entrar(page: Page, apelido = 'gruposgestore2e') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(apelido.includes('gestor') ? '/gestao' : '/meu-dia')
}

function resumo(page: Page, nome: string) {
  return page.locator('dt').filter({ hasText: new RegExp(`^${nome}$`) }).locator('xpath=following-sibling::dd')
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
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial,iniciada_em) VALUES($1,$2,'legado',now())",[id,vendedor.id])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)', [id, vendedor.id])
  await banco.sql('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,100,gen_random_uuid())',[id,vendedor.id])
  await banco.sql(`INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data)
    VALUES ($1,'acompanhamento','Histórico preservado da jornada','Retorno preservado',(now() AT TIME ZONE 'America/Sao_Paulo')::date)`, [id])
  await banco.sql('UPDATE empresa_vinculo SET agenda_contato_id=(SELECT id FROM contato WHERE empresa_id=$1) WHERE empresa_id=$1',[id])
})

test('listas históricas permitem corrigir contexto, renomear e desativar preservando atendimento', async ({ page, browser }) => {
  test.setTimeout(90_000)
  await entrar(page)
  const cadastroAntes = await comBancoGrupos(async c => (await c.query('SELECT * FROM empresa WHERE cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)
  const filaAntes = await comBancoGrupos(async c => (await c.query('SELECT f.* FROM empresa_fila f JOIN empresa e ON e.id=f.empresa_id WHERE e.cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)
  const contatoAntes = await comBancoGrupos(async c => (await c.query('SELECT c.* FROM contato c JOIN empresa e ON e.id=c.empresa_id WHERE e.cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)
  expect(filaAntes).toHaveLength(1)
  expect(contatoAntes).toHaveLength(1)
  const { autor, empresas } = await comBancoGrupos(async c => {
    const { rows: [gestor] } = await c.query("SELECT id FROM usuario WHERE email='gruposgestore2e@teste.local'")
    for (const [cnpj,nome] of [[CNPJ_JORNADA_NOVA,NOVA],[CNPJ_JORNADA_OVERLAP,OVERLAP]]) {
      await c.query("INSERT INTO empresa(cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cnae_principal) VALUES($1,$2,'Fantasia da planilha','Pessoa fictícia','11999990777','grupo@teste.local','7777702') ON CONFLICT(cnpj) DO NOTHING",[cnpj,nome])
    }
    const { rows } = await c.query('SELECT id FROM empresa WHERE cnpj=ANY($1::text[])',[[CNPJ_JORNADA_NOVA,CNPJ_JORNADA_OVERLAP,CNPJ_JORNADA_CARTEIRA]])
    return { autor: gestor.id, empresas: rows.map(e => e.id) }
  })
  const grupoId = await criarListaHistorica(NOME, empresas, autor)
  await page.goto('/empresas/grupos/'+grupoId)
  await expect(page.getByRole('main').locator('[data-slot=badge]').first()).toHaveText('Ativo')
  const urlGrupo = page.url()
  await expect(page.getByRole('heading', { name: NOME, exact: true })).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(4)
  expect(await comBancoGrupos(async c => (await c.query('SELECT * FROM empresa WHERE cnpj=$1', [CNPJ_JORNADA_CARTEIRA])).rows)).toEqual(cadastroAntes)

  const contextoLista = page.getByRole('region', { name: 'Contexto da lista' })
  await expect(contextoLista.locator('dl')).toContainText('Coleta fictícia E2E')
  const pedidoOriginal = await comBancoGrupos(async c => (await c.query('SELECT pedido FROM grupo_importacao WHERE id=$1', [urlGrupo.split('/').at(-1)])).rows)
  await contextoLista.getByText('Corrigir contexto da lista', { exact: true }).click()
  await contextoLista.getByLabel('Resumo da lista', { exact: true }).fill('Contexto revisado pelo gestor')
  await contextoLista.getByLabel('Origem dos dados', { exact: true }).fill('Revisão da coleta fictícia')
  await contextoLista.getByLabel('Critérios usados', { exact: true }).fill('Contato validado na revisão')
  await contextoLista.getByRole('button', { name: 'Salvar contexto', exact: true }).click()
  await expect(contextoLista.getByRole('status')).toHaveText('Contexto atualizado.')
  await expect(contextoLista.locator('dl')).toContainText('Revisão da coleta fictícia')
  expect(await comBancoGrupos(async c => (await c.query('SELECT pedido FROM grupo_importacao WHERE id=$1', [urlGrupo.split('/').at(-1)])).rows)).toEqual(pedidoOriginal)

  const overlapId = await comBancoGrupos(async c => (await c.query('SELECT id FROM empresa WHERE cnpj=$1',[CNPJ_JORNADA_OVERLAP])).rows[0].id)
  await criarListaHistorica('Outra origem da jornada', [overlapId], autor)
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
  await expect(page.getByRole('region', { name: 'Empresas cadastradas' }).getByRole('listitem')).toHaveCount(3)
  const nova = page.getByRole('region', { name: 'Empresas cadastradas' }).getByRole('listitem').filter({ hasText: formatarCnpj(CNPJ_JORNADA_NOVA) })
  await nova.getByRole('button', { name: 'Ver empresa: Fantasia da planilha', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(NOVA)
  await page.keyboard.press('Escape')

  const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const vendedor = await contexto.newPage()
    await entrar(vendedor, 'gruposjornadae2e')
    await expect(vendedor.getByRole('heading', { name: CARTEIRA, exact: true })).toHaveCount(0)
    await vendedor.goto('/carteira')
    await expect(vendedor.getByRole('heading', { name: CARTEIRA, exact: true })).toBeVisible()
    await vendedor.getByRole('link', { name: 'Ver cliente', exact: true }).click()
    await expect(vendedor.getByText('Histórico preservado da jornada', { exact: true })).toBeVisible()
    await vendedor.goto(`/fila/localizar?legado=1&nome=${encodeURIComponent(NOVA)}`)
    await expect(vendedor.getByRole('heading', { name: 'Nenhuma empresa com esses filtros', exact: true })).toBeVisible()
    await vendedor.goto(`/fila/localizar?legado=1&nome=${encodeURIComponent(OVERLAP)}`)
    await expect(vendedor.getByRole('heading',{name:OVERLAP,exact:true})).toHaveCount(0)
    await page.goto(urlGrupo)
    await page.getByRole('button', { name: 'Reativar grupo', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('table').getByRole('row').filter({ hasText: NOVA })).toContainText('Disponível')
    await vendedor.goto(`/fila/localizar?legado=1&nome=${encodeURIComponent(NOVA)}`)
    await expect(vendedor.getByRole('heading', { name: NOVA, exact: true })).toHaveCount(0)
  } finally { await contexto.close() }
})

test('gestão real de grupos conserva reflow desktop e celular nos dois temas com diálogo e página vazia', async ({ page }) => {
  test.setTimeout(90_000)
  await entrar(page)
  for (const tema of ['light', 'dark']) {
    for (const width of [390, 820, 1100, 1200, 1280, 1920]) {
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
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/grupos-lista-${tema}-${width}.png`, fullPage: true })
      // Playwright rola o container até o link real, inclusive em 390px.
      await page.getByRole('link', { name: `Ver lista ${GRUPOS[0][1]}`, exact: true }).click()
      await expect(page.getByRole('heading', { name: GRUPOS[0][1], exact: true })).toBeVisible()
      await expect(page.getByText('Criada por gruposgestore2e em', { exact: false })).toBeVisible()
      await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
      await expect(resumo(page, 'Empresas')).toHaveText('5')
      await expect(resumo(page, 'Disponíveis')).toHaveText('2')
      await expect(resumo(page, 'Em carteiras')).toHaveText('1')
      await expect(resumo(page, 'Reservadas')).toHaveText('1')
      await expect(resumo(page, 'Outros impedimentos')).toHaveText('1')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/grupos-detalhe-${tema}-${width}.png`, fullPage: true })
      await expect(page.getByRole('main')).toHaveCSS('padding-left', width <= 820 ? '16px' : '32px')
      const contexto = page.getByRole('region', { name: 'Contexto da lista' })
      await expect(contexto).toHaveCSS('border-radius', '10px')
      await expect(contexto).toHaveCSS('padding-top', width <= 820 ? '20px' : '24px')
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
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/grupos-dialogo-${tema}-${width}.png` })
      await page.keyboard.press('Escape')
      await expect(dialogo).toHaveCount(0)
      await expect(abrir).toBeFocused()
      await page.goto('/empresas/grupos?pagina=999')
      await page.getByLabel('Tema de Empresas').selectOption(tema)
      await expect(page.locator('.crm-ui').first()).toHaveAttribute('data-theme', tema)
      await expect(page.getByRole('heading', { name: 'Nenhuma lista nesta página' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Nenhuma lista nesta página' })).toHaveCSS('font-size', '16px')
      await expect(page.getByRole('heading', { name: 'Nenhuma lista nesta página' })).toHaveCSS('line-height', '24px')
      await expect(page.getByText('Volte à primeira página para consultar as listas existentes.')).toBeVisible()
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/grupos-vazio-${tema}-${width}.png`, fullPage: true })
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
