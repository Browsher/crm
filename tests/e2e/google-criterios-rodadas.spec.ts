import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { expect, test, type Page } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness, comBancoGrupos } from './dados-grupos'
import { GOOGLE_TOKEN_E2E } from './dados-google'
import { hojeEmSaoPaulo, semanaDe } from '../../src/features/google/regras'
import { criteriosVazios, verificacoesNecessarias, type CriteriosGoogle } from '../../src/lib/google/criterios'

async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/login/)
}

test('planejamento, cópia histórica, sexta 17h, lotes condicionais e auditoria privada', async ({ page, request, browser }) => {
  test.setTimeout(150000)
  const banco = bancoGruposDoHarness()
  const vendedor = await criarUsuarioComSenha(banco, 'vendedor', 'criteriosrodadase2e', 'Senha-e2e-2026')
  const outro = await criarUsuarioComSenha(banco, 'vendedor', 'criteriosoutroe2e', 'Senha-e2e-2026')
  const dias = semanaDe(hojeEmSaoPaulo())!.map(d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 14); return x.toISOString().slice(0, 10) })
  const historico = new Date(dias[0] + 'T12:00:00Z'); historico.setUTCDate(historico.getUTCDate() - 28)
  const [{ id: origem }] = await banco.sql<{ id: string }>("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,criterios) VALUES ($1,$2,'Papelarias históricas','Brás','São Paulo','SP','{\"telefone\":[\"fixo\"]}') RETURNING id", [vendedor.id, historico.toISOString().slice(0, 10)])
  await entrar(page, 'criteriosrodadase2e@teste.local')
  await page.goto('/fila/google?semana=' + dias[0])
  await page.getByRole('button', { name: 'Editar planejamento', exact: true }).click()
  for (const dia of ['segunda-feira', 'terça-feira']) {
    await page.getByRole('textbox', { name: new RegExp('^Nicho de ' + dia) }).fill('Lojas semanais')
    await page.getByRole('textbox', { name: new RegExp('^Cidade de ' + dia) }).fill('Campinas')
    await page.getByRole('combobox', { name: new RegExp('^UF de ' + dia) }).selectOption('SP')
  }
  await page.getByRole('button', { name: 'Salvar planejamento', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(/salvo|sincronizado/i)
  await page.getByRole('button', { name: 'Espelhar um dia', exact: true }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Semana de origem').selectOption(historico.toISOString().slice(0, 10))
  await dialogo.getByLabel('Dia de origem').selectOption(origem)
  await dialogo.getByRole('checkbox', { name: 'Nicho', exact: true }).uncheck()
  await dialogo.getByRole('checkbox', { name: 'Critérios de busca', exact: true }).check()
  await dialogo.getByRole('checkbox', { name: /^terça-feira/ }).check()
  await dialogo.getByRole('button', { name: 'Espelhar nos dias escolhidos' }).click()
  await expect(dialogo.getByRole('status')).toContainText(/espelhado|sincronizado/i)
  await dialogo.getByRole('button', { name: 'Concluir', exact: true }).click()
  const planos = await banco.sql<{ id: string; dia: string; criterios: CriteriosGoogle }>("SELECT id,to_char(dia,'YYYY-MM-DD') AS dia,criterios FROM google_planejamento WHERE vendedor_id=$1 AND dia=ANY($2::date[]) ORDER BY dia", [vendedor.id, dias.slice(0, 2)])
  expect(planos[0].criterios.telefone).toEqual([])
  expect(planos[1].criterios.telefone).toEqual(['fixo'])
  expect(await banco.sql('SELECT nicho,cidade,bairro FROM google_planejamento WHERE id=$1', [planos[1].id])).toEqual([{ nicho: 'Lojas semanais', cidade: 'Campinas', bairro: '' }])
  const gestor = process.env.GOOGLE_AGENTE_USUARIO_ID!
  const executor = randomUUID()
  const headers = { Authorization: 'Bearer ' + GOOGLE_TOKEN_E2E }
  const chamar = async (data: Record<string, unknown>) => { const r = await request.post('/api/agente/google', { headers, data: { executor, ...data } }); expect(r.status(), await r.text()).toBe(200); return r.json() }
  type Pedido = { id: string; execucao_id: string; revisao: number; snapshot_sha256: string; snapshot: { nicho: string; criterios: CriteriosGoogle } }
  const iniciar = async (dia: string): Promise<Pedido> => {
    const [{ r }] = await banco.sql<{ r: { pedido: Pedido } }>("SELECT google_coordenar_em($2,$3::timestamptz) AS r FROM (SELECT set_config('app.usuario_id',$1,false) OFFSET 0) x", [gestor, executor, dia + 'T17:00:00-03:00'])
    return r.pedido
  }
  const pausados = await banco.sql<{ vendedor_id: string }>('SELECT vendedor_id FROM google_agente WHERE NOT pausado AND vendedor_id<>$1', [vendedor.id])
  await banco.sql('UPDATE google_agente SET pausado=true WHERE vendedor_id<>$1', [vendedor.id])
  try {
    const sexta = new Date(dias[0] + 'T12:00:00Z'); sexta.setUTCDate(sexta.getUTCDate() - 3)
    const pedido = await iniciar(sexta.toISOString().slice(0, 10))
    expect(pedido.id).toBe(planos[0].id)
    await page.reload()
    await page.getByRole('button', { name: 'Editar planejamento', exact: true }).click()
    await page.getByRole('textbox', { name: /^Nicho de segunda-feira/ }).fill('Edição posterior à coleta')
    await page.getByRole('button', { name: 'Salvar planejamento', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(/salvo|sincronizado/i)
    expect((await chamar({ acao: 'proximo' })).pedido.snapshot.nicho).toBe('Lojas semanais')
    const fluxo = JSON.parse(await readFile('workflows/n8n/google/verificar-empresas.json', 'utf8'))
    const codigo = fluxo.nodes.find((n: { name: string }) => n.name === 'Conferir telefone fixo').parameters.jsCode
    const publicar = async (p: Pedido, candidatas: Record<string, unknown>[], criterios = criteriosVazios()) => {
      const lote_id = randomUUID()
      const lote = { lote_id, candidatas }
      await chamar({ acao: 'reservar_lote', pedido: p.id, lote })
      await chamar({ acao: 'reservar_lote', pedido: p.id, lote })
      const evidencias = criterios.telefone.length ? runInNewContext('(function(){' + codigo + '})()', { $input: { first: () => ({ json: { candidatas, evidencias: [] } }) }, Date, JSON })[0].json.evidencias : []
      const recibo = { versao: 2, pedido_id: p.id, execucao_id: p.execucao_id, lote_id, revisao: p.revisao, snapshot_sha256: p.snapshot_sha256, origem_sha256: 'a'.repeat(64), resultado_sha256: 'b'.repeat(64), arquivo_original_id: 'raw-ficticio', arquivo_resultado_id: 'resultado-ficticio', verificacoes_requeridas: verificacoesNecessarias(criterios), evidencias }
      expect(await chamar({ acao: 'entregar', pedido: p.id, empresas: candidatas, recibo })).toEqual({ resultado: 'ok' })
      expect(await chamar({ acao: 'entregar', pedido: p.id, empresas: candidatas, recibo })).toEqual({ resultado: 'repetida' })
    }
    await publicar(pedido, [{ google_place_id: 'rodadas-direta', nome_fantasia: 'Empresa entregue sem telefone' }])
    await chamar({ acao: 'concluir', pedido: pedido.id, motivo: 'sem_novidades' })
    const fixo = await iniciar(dias[0])
    expect(fixo.id).toBe(planos[1].id)
    for (let i = 0; i < 3; i++) await publicar(fixo, [{ google_place_id: 'rodadas-fixo-' + i, nome_fantasia: 'Empresa para ligação ' + i, telefone: i ? '113333447' + i : '11999998888' }], { ...criteriosVazios(), telefone: ['fixo'] })
    await chamar({ acao: 'concluir', pedido: fixo.id, motivo: 'limite_lotes' })
    expect(await banco.sql('SELECT analisadas,entregues,lotes_reservados FROM google_execucao WHERE pedido_id=$1', [fixo.id])).toEqual([{ analisadas: 3, entregues: 2, lotes_reservados: 3 }])
    await page.goto('/fila/google/' + pedido.id)
    await expect(page.getByRole('heading', { name: 'Empresa entregue sem telefone', exact: true })).toBeVisible()
    await expect(page.getByText('Sem telefone informado', { exact: true })).toBeVisible()
    await page.goto('/fila/google/' + fixo.id)
    await expect(page.getByRole('heading', { name: 'Empresa para ligação 1', exact: true })).toBeVisible()
    await expect(page.getByText('Formato de telefone fixo conferido', { exact: true }).first()).toBeVisible()
    const outraSessao = await browser.newContext()
    const outraPagina = await outraSessao.newPage()
    await entrar(outraPagina, 'criteriosoutroe2e@teste.local')
    await outraPagina.goto('/fila/google/' + fixo.id)
    await expect(outraPagina.getByText('Empresa para ligação 1', { exact: true })).toHaveCount(0)
    await outraSessao.close()
    const sessaoGestor = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const gestao = await sessaoGestor.newPage()
    await entrar(gestao, 'gestore2e@teste.local')
    await gestao.goto('/empresas/google/' + fixo.id)
    await expect(gestao.getByRole('heading', { name: 'Empresa para ligação 0', exact: true })).toBeVisible()
    await expect(gestao.getByText('Não atende aos critérios selecionados.', { exact: true })).toBeVisible()
    await gestao.evaluate(() => window.scrollTo(0, 0))
    await gestao.screenshot({ path: '.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-6-captures/google-lotes-auditoria.png', fullPage: true })
    await sessaoGestor.close()
  } finally {
    await banco.sql('UPDATE google_agente SET pausado=false WHERE vendedor_id=ANY($1::uuid[])', [pausados.map(p => p.vendedor_id)])
  }
  expect(outro.id).not.toBe(vendedor.id)
  await comBancoGrupos(async c => { expect((await c.query('SELECT count(*)::int AS n FROM google_exclusividade WHERE vendedor_id=$1', [outro.id])).rows[0].n).toBe(0) })
})
