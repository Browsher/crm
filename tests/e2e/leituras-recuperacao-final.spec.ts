import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

async function sql(texto: string, valores: unknown[] = []) { const url = process.env.DATABASE_URL_ADMIN!; exigirAdminLocal(url); return comAdmin(url, c => c.query(texto, valores)) }
let email: string
test.beforeEach(async () => {
  email = 'revisao-' + randomUUID() + '@teste.local'
  const r = await sql("INSERT INTO usuario(nome,email,papel) VALUES('Revisão final',$1,'vendedor') RETURNING id", [email])
  await sql(`INSERT INTO autenticacao.credencial(usuario_id,senha_hash)
    SELECT $1,c.senha_hash FROM autenticacao.credencial c JOIN usuario u ON u.id=c.usuario_id WHERE u.email='seminteressee2e@teste.local'`, [r.rows[0].id])
})
async function entrar(page: Page) {
  await page.goto('/login'); await page.getByLabel('E-mail').fill(email); await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL('/meu-dia')
}
async function atores() { return { eu: (await sql('SELECT id FROM usuario WHERE email=$1', [email])).rows[0].id as string, outro: (await sql("SELECT id FROM usuario WHERE email='funiloutroe2e@teste.local'")).rows[0].id as string } }
async function preparar(nome: string, arquivo: boolean) {
  const { eu, outro } = await atores(), empresa = randomUUID(), grupo = randomUUID()
  await comAdmin(process.env.DATABASE_URL_ADMIN!, async c => {
    await c.query('BEGIN')
    try {
      await c.query("SELECT set_config('app.usuario_id',$1,true)", [eu])
      await c.query("INSERT INTO empresa(id,razao_social,telefone) VALUES($1,$2,'11987654321')", [empresa, nome])
      await c.query("INSERT INTO grupo_importacao(id,nome) VALUES($1,'Origem revisão final')", [grupo])
      await c.query('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [grupo, empresa])
      await c.query("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'banco')", [empresa, eu])
      const r = await c.query(arquivo ? 'SELECT empresa_sem_interesse_definir($1,$2,1,NULL) r' : "SELECT contato_registrar_direto($1,$2,1,'interessado','História própria revisão','Agenda antiga revisão','2026-01-01') r", [empresa, randomUUID()])
      expect(r.rows[0].r.ok).toBe(true)
      await c.query('COMMIT')
    } catch (e) { await c.query('ROLLBACK'); throw e }
  })
  return { empresa, grupo, eu, outro }
}
const card = (page: Page, nome: string) => page.locator('[data-slot=card]').filter({ has: page.getByRole('heading', { name: nome, exact: true }) })

test('arquivo indisponível mantém consulta e histórico, sem retomada nova', async ({ page }) => {
  const c = await preparar('Revisão arquivo indisponível', false)
  await comAdmin(process.env.DATABASE_URL_ADMIN!, async db => {
    await db.query('BEGIN'); await db.query("SELECT set_config('app.usuario_id',$1,true)", [c.eu])
    const r = await db.query('SELECT empresa_sem_interesse_definir(empresa_id,$2,versao,NULL) r FROM empresa_vinculo WHERE empresa_id=$1', [c.empresa, randomUUID()])
    expect(r.rows[0].r.ok).toBe(true); await db.query('COMMIT')
  })
  await sql('UPDATE grupo_importacao SET ativo=false WHERE id=$1', [c.grupo])
  await entrar(page); await page.goto('/fila/sem-interesse?nome=Revis%C3%A3o+arquivo+indispon%C3%ADvel')
  await expect(card(page, 'Revisão arquivo indisponível')).toContainText('Indisponível')
  await expect(card(page, 'Revisão arquivo indisponível').getByRole('button', { name: 'Retomar atendimento', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver empresa: Revisão arquivo indisponível' }).click()
  await expect(page.getByRole('dialog')).toContainText('Revisão arquivo indisponível')
  expect((await sql('SELECT nota FROM contato WHERE empresa_id=$1', [c.empresa])).rows).toEqual([{ nota: 'História própria revisão' }])
})

test('Funil separa agenda vigente de outro autor do histórico próprio e não ressuscita agenda nula', async ({ page }) => {
  const c = await preparar('Revisão agenda canônica', false)
  await sql('UPDATE empresa_vinculo SET agenda_contato_id=NULL WHERE empresa_id=$1', [c.empresa])
  await entrar(page); await page.goto('/funil')
  await card(page, 'Revisão agenda canônica').getByRole('button', { name: 'Abrir no funil', exact: true }).click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toContainText('Sem próximo passo combinado')
  await dialogo.getByRole('tab', { name: 'Histórico', exact: true }).click()
  await expect(dialogo).toContainText('Agenda antiga revisão'); await page.keyboard.press('Escape')
  await comAdmin(process.env.DATABASE_URL_ADMIN!, async db => {
    await db.query('BEGIN'); await db.query("SELECT set_config('app.usuario_id',$1,true)", [c.outro])
    const r = await db.query("INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data) VALUES($1,'acompanhamento','Nota alheia privada','Agenda vigente revisão','2026-01-02') RETURNING id", [c.empresa])
    await db.query('UPDATE empresa_vinculo SET agenda_contato_id=$2 WHERE empresa_id=$1', [c.empresa, r.rows[0].id]); await db.query('COMMIT')
  })
  await page.reload(); await card(page, 'Revisão agenda canônica').getByRole('button', { name: 'Abrir no funil', exact: true }).click()
  await expect(dialogo).toContainText('Agenda vigente revisão')
  await dialogo.getByRole('tab', { name: 'Histórico', exact: true }).click()
  await expect(dialogo).toContainText('História própria revisão'); await expect(dialogo).not.toContainText('Nota alheia privada')
  await page.goto('/meu-dia'); await expect(page.getByRole('main')).toContainText('Revisão agenda canônica')
  await expect(page.getByRole('main')).toContainText('Agenda vigente revisão')
})

for (const tipo of ['arquivar', 'retomar'] as const) test(`${tipo}: resposta perdida, recusa antes do recibo, reload e replay preservam intenção`, async ({ page }) => {
  const nome = 'Revisão recuperação ' + tipo, c = await preparar(nome + ' A', tipo === 'retomar'), b = await preparar(nome + ' B', tipo === 'retomar')
  const rota = tipo === 'arquivar' ? '/funil' : '/fila/sem-interesse?nome=' + encodeURIComponent(nome)
  const confirmar = tipo === 'arquivar' ? 'Confirmar envio anterior' : 'Confirmar retomada anterior'
  const storagePrefix = tipo === 'arquivar' ? 'crm:funil:arquivo:v1:' : 'crm:retomar-arquivo:v1:'
  await entrar(page); await page.goto(rota)
  let perder = true
  await page.route(tipo === 'arquivar' ? '**/funil*' : '**/fila/sem-interesse*', async route => {
    if (!perder || route.request().method() !== 'POST') return route.continue()
    perder = false; await route.fetch(); await route.abort('failed')
  })
  const origem = tipo === 'arquivar' ? page.locator('[draggable]').filter({ has: page.getByRole('heading', { name: nome + ' A', exact: true }) }) : card(page, nome + ' A')
  await origem.getByRole('button', { name: tipo === 'arquivar' ? 'Marcar como Sem interesse' : 'Retomar atendimento', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Não foi possível confirmar')
  const salvo = await page.evaluate(k => sessionStorage.getItem(k), storagePrefix + c.eu)
  expect(salvo).toBeTruthy()
  const comando = JSON.parse(salvo!), chave = comando.chave
  const retratoB = (await sql('SELECT to_jsonb(v) v FROM empresa_vinculo v WHERE empresa_id=$1', [b.empresa])).rows
  await expect(card(page, nome + ' B').getByRole('button', { name: 'Retomar atendimento', exact: true })).toHaveCount(0)
  await card(page, nome + ' B').getByRole('button', { name: 'Ver empresa: ' + nome + ' B' }).click()
  await expect(page.getByRole('dialog')).toContainText(nome + ' B'); await page.keyboard.press('Escape')
  // Simula a alteração de autorização por outra sessão depois do primeiro commit.
  await sql('UPDATE empresa_vinculo SET vendedor_id=$2 WHERE empresa_id=$1', [c.empresa, c.outro])
  await page.getByRole('button', { name: confirmar, exact: true }).click()
  await expect(page.getByRole('status')).toContainText('não tem permissão')
  expect(await page.evaluate(k => sessionStorage.getItem(k), storagePrefix + c.eu)).toBe(salvo)
  await page.reload(); await expect(page.getByRole('button', { name: confirmar, exact: true })).toBeVisible()
  await sql('UPDATE empresa_vinculo SET vendedor_id=$2 WHERE empresa_id=$1', [c.empresa, c.eu])
  await page.getByRole('button', { name: confirmar, exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Envio anterior confirmado')
  expect(await page.evaluate(k => sessionStorage.getItem(k), storagePrefix + c.eu)).toBeNull()
  expect((await sql('SELECT count(*)::int n FROM empresa_atendimento_operacao WHERE chave=$1', [chave])).rows).toEqual([{ n: 1 }])
  expect((await sql('SELECT to_jsonb(v) v FROM empresa_vinculo v WHERE empresa_id=$1', [b.empresa])).rows).toEqual(retratoB)
})
