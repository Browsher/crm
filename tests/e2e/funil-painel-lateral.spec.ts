import { abrirLeitura } from './paineis-ajuda'
import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { comoUsuario } from '../../src/server/db/como-usuario'
import { vincularEmpresaTeste } from '../integracao/atendimento-fixtures'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness } from './dados-grupos'

const senha = 'Senha-e2e-2026'
const etapa = (page: Page, nome: string) => page.getByRole('region', { name: nome, exact: true })
const painel = (page: Page) => page.locator('[data-painel-lateral]')
const card = (page: Page, nome: string) => page.locator('article[draggable]').filter({ has: page.getByRole('heading', { name: nome, exact: true }) })
const abrirArquivo = (page: Page) => page.getByRole('button', { name: 'Sem interesse', exact: true })
const confirmarArquivo = (page: Page) => page.getByRole('dialog', { name: 'Marcar como Sem interesse?', exact: true })
type Situacao = { agenda_contato_id: string | null; arquivada_em: Date | null }

async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
}

test('lixeira confirma antes de arquivar, lista três do Funil e devolve uma vez após resposta perdida', async ({ page, context }) => {
  const banco = bancoGruposDoHarness()
  const apelido = 'funil-lateral-' + randomUUID().slice(0, 8)
  const eu = await criarUsuarioComSenha(banco, 'vendedor', apelido, senha)
  async function empresa(nome: string, tipo: 'direta' | 'funil' | 'aberta') {
    const id = randomUUID()
    await banco.sql('INSERT INTO empresa(id,razao_social,telefone) VALUES($1,$2,$3)', [id, nome, '11900000000'])
    const versao = await vincularEmpresaTeste(banco, id, eu.id, 'legado')
    if (tipo === 'direta') {
      const { linhas } = await comoUsuario(eu.id, e => e<{ r: { ok: boolean } }>(
        "SELECT contato_registrar_direto($1,$2,$3,'sem_interesse',NULL,NULL,NULL) r", [id, randomUUID(), versao],
      ))
      expect(linhas[0].r.ok).toBe(true)
      return { id, negociacao: null }
    }
    const { linhas } = await comoUsuario(eu.id, e => e<{ r: { ok: boolean } }>(
      "SELECT contato_registrar_direto($1,$2,$3,'interessado','História preservada','Agenda antiga','2030-01-01') r", [id, randomUUID(), versao],
    ))
    expect(linhas[0].r.ok).toBe(true)
    const [negociacao] = await banco.sql<{ id: string }>(
      "UPDATE negociacao SET etapa='proposta_enviada' WHERE empresa_id=$1 RETURNING id", [id],
    )
    if (tipo === 'funil') {
      const [v] = await banco.sql<{ versao: number }>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1', [id])
      const resultado = await comoUsuario(eu.id, e => e<{ r: { ok: boolean } }>(
        'SELECT empresa_sem_interesse_definir($1,$2,$3,$4) r', [id, randomUUID(), v.versao, negociacao.id],
      ))
      expect(resultado.linhas[0].r.ok).toBe(true)
    }
    return { id, negociacao: negociacao.id }
  }

  for (const numero of [1, 2, 3, 4]) await empresa('Arquivo lateral ' + numero, 'funil')
  await empresa('Somente no arquivo geral', 'direta')
  const nome = 'Proposta para devolver'
  const alvo = await empresa(nome, 'aberta')
  await empresa('Segunda negociação com título comprido para medir a altura uniforme', 'aberta')
  await entrar(page, apelido + '@teste.local')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/funil')
  await expect(card(page, nome)).toContainText('Agenda antiga')
  await card(page, nome).getByRole('button', { name: 'Negociação', exact: true }).click()
  await expect(painel(page).getByRole('tab', { name: 'Resumo', exact: true })).toHaveCount(0)
  await painel(page).getByRole('button', { name: 'Histórico', exact: true }).click()
  await expect(painel(page).locator('details[open]')).toHaveCount(0)
  await painel(page).getByRole('button', { name: 'Expandir todos', exact: true }).click()
  await expect(painel(page).getByText('História preservada', { exact: true })).toBeVisible()
  await painel(page).getByRole('button', { name: 'Voltar', exact: true }).click()
  await painel(page).getByRole('button', { name: 'Atendimento e próximo passo', exact: true }).click()
  await abrirLeitura(page)
  await painel(page).getByRole('button', { name: 'Registrar venda', exact: true }).click()
  await painel(page).getByLabel('Valor em reais').fill('150,00')
  await page.getByRole('navigation', { name: 'Navegação do CRM' }).getByRole('link', { name: 'Meu dia', exact: true }).click()
  const descartar = page.getByRole('dialog', { name: 'Descartar alterações?', exact: true })
  await descartar.getByRole('button', { name: 'Descartar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/funil')
  await expect(card(page, nome)).toContainText('Agenda antiga')
  const tamanhos = await page.locator('article[draggable]').evaluateAll(cartoes =>
    cartoes.map(c => c.getBoundingClientRect().height),
  )
  expect(tamanhos).toHaveLength(2)
  expect(tamanhos[0]).toBe(tamanhos[1])
  await card(page, nome).getByRole('button', { name: 'Dados da empresa', exact: true }).click()
  await expect(painel(page)).toContainText('Contatos')
  await expect(painel(page)).toContainText('Cadastro')
  await expect(painel(page)).not.toContainText('Registrar venda')
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0)
  const lateral = (await painel(page).boundingBox())!
  expect(lateral.y).toBe(0)
  expect(lateral.height).toBe(900)
  expect(lateral.x + lateral.width).toBe(await page.evaluate(() => innerWidth))
  await painel(page).getByRole('button', { name: 'Fechar', exact: true }).click()

  await abrirArquivo(page).click()
  await expect(painel(page).getByRole('button', { name: /^Devolver/ })).toHaveCount(3)
  await expect(painel(page)).toContainText('Arquivo lateral 4')
  await expect(painel(page)).not.toContainText('Arquivo lateral 1')
  await expect(painel(page)).not.toContainText('Somente no arquivo geral')
  await expect(painel(page).getByRole('link', { name: 'Ver todos em Sem interesse' })).toHaveAttribute('href', '/fila/localizar?disponibilidade=sem_interesse&pagina=1')
  await painel(page).getByRole('button', { name: 'Fechar', exact: true }).click()

  const lixeira = page.locator('[data-descarte]')
  await card(page, nome).dragTo(lixeira)
  await expect(confirmarArquivo(page)).toContainText(nome)
  await expect(page.locator('[data-efeito-arquivo]')).toHaveCount(0)
  await confirmarArquivo(page).getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(etapa(page, 'Proposta enviada')).toContainText(nome)
  await expect(confirmarArquivo(page)).toHaveCount(0)
  await card(page, nome).dragTo(lixeira)
  await confirmarArquivo(page).getByRole('button', { name: 'Confirmar Sem interesse', exact: true }).click()
  await expect(page.locator('[data-efeito-arquivo]').first()).toBeAttached()
  await expect(card(page, nome)).toHaveCount(0)
  await abrirArquivo(page).click()
  const devolver = 'Devolver ' + nome + ' para Primeiro contato'
  await expect(painel(page).getByRole('button', { name: /^Devolver/ }).first()).toHaveAccessibleName(devolver)

  const outra = await context.newPage()
  try {
    await outra.goto('/funil')
    await abrirArquivo(outra).click()
    const envios: string[] = []
    await page.route('**/funil*', async rota => {
      const corpo = rota.request().postData()
      if (rota.request().method() !== 'POST' || !corpo?.includes(alvo.id)) return rota.continue()
      envios.push(corpo)
      if (envios.length > 1) return rota.continue()
      const resposta = await rota.fetch()
      expect(resposta.ok()).toBe(true)
      await rota.abort('failed')
    })
    await painel(page).getByRole('button', { name: devolver, exact: true }).click()
    await expect(page.getByRole('button', { name: 'Confirmar devolução anterior', exact: true })).toBeVisible()
    await painel(outra).getByRole('button', { name: devolver, exact: true }).click()
    await page.reload()
    await expect(etapa(page, 'Primeiro contato')).toContainText(nome)
    const recuperar = page.getByRole('button', { name: 'Confirmar devolução anterior', exact: true })
    await recuperar.focus()
    await recuperar.press('Enter')
    await expect(recuperar).toHaveCount(0)
    expect(envios).toHaveLength(2)
    const chave = envios[0].match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi)!
      .find(id => id !== alvo.id && id !== alvo.negociacao)
    expect(chave).toBeTruthy()
    expect(envios[1]).toContain(chave!)
    expect(await banco.sql('SELECT etapa,encerramento FROM negociacao WHERE empresa_id=$1 ORDER BY encerrada_em NULLS LAST', [alvo.id]))
      .toEqual([{ etapa: 'proposta_enviada', encerramento: 'sem_interesse' }, { etapa: 'primeiro_contato', encerramento: null }])
    expect(await banco.sql<Situacao>('SELECT agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id=$1', [alvo.id]))
      .toEqual([{ agenda_contato_id: null, arquivada_em: null }])
    expect(await banco.sql('SELECT nota FROM contato WHERE empresa_id=$1', [alvo.id])).toEqual([{ nota: 'História preservada' }])
  } finally {
    await outra.close()
  }
})
