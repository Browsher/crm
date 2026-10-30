import { expect, test, type Page } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness } from './dados-grupos'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

let empresaId: string
let grupoId: string
let negociacaoId: string
async function entrar(page: Page, papel: 'gestor' | 'vendedor') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`arquivo${papel}e2e@teste.local`)
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(papel === 'gestor' ? '/gestao' : '/meu-dia')
}
test.beforeAll(async () => {
  const banco = bancoGruposDoHarness()
  const pronta = await banco.sql<{ id: string }>("SELECT id FROM empresa WHERE razao_social='Jornada arquivo sintética'")
  if (pronta.length) {
    empresaId = pronta[0].id
    grupoId = (await banco.sql<{ grupo_id: string }>('SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1', [empresaId]))[0].grupo_id
    negociacaoId = (await banco.sql<{ id: string }>('SELECT id FROM negociacao WHERE empresa_id=$1', [empresaId]))[0].id
    return
  }
  await criarUsuarioComSenha(banco,'gestor','arquivogestore2e','Senha-e2e-2026')
  const vendedor = await criarUsuarioComSenha(banco,'vendedor','arquivovendedore2e','Senha-e2e-2026')
  empresaId = (await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('Jornada arquivo sintética','11987654321') RETURNING id"))[0].id
  grupoId = (await banco.sql<{ id: string }>("INSERT INTO grupo_importacao(nome) VALUES('Lista arquivada sintética E2E') RETURNING id"))[0].id
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [grupoId,empresaId])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')", [empresaId,vendedor.id])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [empresaId,vendedor.id])
  negociacaoId = (await banco.sql<{ id: string }>('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2) RETURNING id', [empresaId,vendedor.id]))[0].id
  const [{ id: contato }] = await banco.sql<{ id: string }>("INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data) VALUES($1,'interessado','Contato sintético preservado','Retorno sintético original',CURRENT_DATE) RETURNING id", [empresaId])
  await banco.sql('UPDATE empresa_vinculo SET agenda_contato_id=$2 WHERE empresa_id=$1', [empresaId,contato])
  const [{ m }] = await banco.sql<{ m: unknown }>('SELECT arquivo_legado_manifesto($1::uuid[]) AS m', [[grupoId]])
  await banco.sql('SELECT arquivo_legado_aplicar($1,$2)', [m,'a'.repeat(64)])
})

test('gestor consulta o arquivo e o histórico; vendedor conserva URLs antigas somente para consulta', async ({ page, browser }) => {
  await entrar(page,'gestor')
  await page.goto('/empresas?q=Jornada%20arquivo%20sintética')
  await expect(page.getByRole('heading', { name: 'Nenhuma empresa encontrada' })).toBeVisible()
  await page.getByRole('link', { name: 'Arquivo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Arquivo de empresas', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Localização atual' }).locator('[aria-current="page"]')).toHaveText('Arquivo')
  const listasArquivadas = page.getByRole('region', { name: 'Listas arquivadas' })
  await expect(listasArquivadas.locator('[data-slot="card"]')).toHaveCount(1)
  await expect(listasArquivadas).toContainText('1 empresa')
  await expect(page.getByRole('heading', { name: 'Jornada arquivo sintética', exact: true })).toBeVisible()
  const capturas = resolve('.superpowers/sdd/limpeza-legado-2026-10-30/capturas')
  await mkdir(capturas,{ recursive: true })
  for (const width of [390,1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('heading', { name: 'Arquivo de empresas', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: resolve(capturas,`arquivo-${width}.png`), fullPage: true })
  }
  await listasArquivadas.getByRole('link', { name: 'Ver lista', exact: true }).click()
  await expect(page).toHaveURL('/empresas/grupos/'+grupoId)
  await expect(page.getByRole('main')).toContainText('Arquivo histórico, somente consulta.')
  await expect(page.getByRole('button', { name: /Reativar|Renomear|Salvar contexto/ })).toHaveCount(0)
  await page.goto('/empresas/'+empresaId)
  await expect(page.getByRole('main')).toContainText('Arquivada')
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page.getByRole('main')).toContainText('Contato sintético preservado')
  await expect(page.getByRole('main')).toContainText('Encerrada por arquivamento da base antiga')
  const contexto = await browser.newContext()
  try {
    const vendedor = await contexto.newPage()
    await entrar(vendedor,'vendedor')
    for (const url of ['/fila/atendimento/'+empresaId,'/carteira/'+empresaId,'/funil?negociacao='+negociacaoId]) {
      await vendedor.goto(url)
      await expect(vendedor.getByRole('main')).toContainText('Contato sintético preservado')
      await expect(vendedor.getByRole('button', { name: /Registrar atendimento|Retomar atendimento|Registrar venda|Iniciar atendimento/ })).toHaveCount(0)
    }
    await vendedor.goto('/empresas/arquivadas')
    await expect(vendedor).not.toHaveURL('/empresas/arquivadas')
  } finally { await contexto.close() }
})
