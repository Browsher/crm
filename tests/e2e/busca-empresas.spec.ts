import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness, comBancoGrupos } from './dados-grupos'

const buscaId = randomUUID()
const googleId = randomUUID()
const nomeBusca = 'Aquisição CNPJ.biz fictícia'
let vendedor: string
let empresaGoogle: string
const lead = { cnpj: '98765432000198', razao_social: 'Loja iluminação fictícia CNPJ', nome_fantasia: 'Iluminação fictícia',
  telefone: '11988887777', email: 'comercial@exemplo.test', cep: null, cnae_principal: '4742300',
  situacao: 'ATIVA', porte: 'ME', data_abertura: '2020-01-15', logradouro: 'Rua fictícia', numero: '10',
  complemento: 'Sala 2', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', telefones: ['11988887777'] }
async function entrar(page: Page, apelido: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(apelido + '@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(apelido === 'buscagestore2e' ? '/gestao' : '/meu-dia')
}
test.beforeAll(async () => {
  const banco = bancoGruposDoHarness()
  vendedor = (await criarUsuarioComSenha(banco, 'vendedor', 'buscavendedore2e', 'Senha-e2e-2026')).id
  await criarUsuarioComSenha(banco, 'gestor', 'buscagestore2e', 'Senha-e2e-2026')
  await banco.sql('INSERT INTO busca_empresa_limite(usuario_id,limite_diario) VALUES ($1,10)', [vendedor])
  const filtros = { palavra: 'iluminação', cnae: '4742300', uf: 'SP', cidade: 'São Paulo', bairro: '',
    porte: 'ME', tipo: '', contato: 'telefoneoucelular', quantidade: 2, offset: 0 }
  await banco.sql(`INSERT INTO busca_empresa(id,usuario_id,nome,filtros,quantidade,estado,empresas,concluido_em)
    VALUES ($1,$2,$3,$4,2,'concluida',$5,now())`, [buscaId, vendedor, nomeBusca, JSON.stringify(filtros),
    JSON.stringify([lead, { ...lead, cnpj: '98765432000279', razao_social: 'Somente email fictício', nome_fantasia: null, telefone: null, telefones: [] }])])
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(nome_fantasia,telefone) VALUES ('Agente Google fictício','11999990501') RETURNING id")
  empresaGoogle = id
  await banco.sql("INSERT INTO empresa_origem_google(google_place_id,empresa_id) VALUES ('place-busca-ficticio',$1)", [id])
  await banco.sql("INSERT INTO grupo_importacao(id,nome,origem,vinculadas) VALUES ($1,'Coleta Google fictícia','Google Maps',1)", [googleId])
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES ($1,$2)', [googleId, id])
})
test.afterAll(async () => {
  await comBancoGrupos(async c => {
    const grupos = (await c.query('SELECT grupo_id FROM busca_empresa WHERE id=$1', [buscaId])).rows.map(r => r.grupo_id).filter(Boolean)
    const empresas = (await c.query('SELECT id FROM empresa WHERE cnpj=$1 OR id=$2', [lead.cnpj, empresaGoogle])).rows.map(r => r.id)
    await c.query('DELETE FROM busca_empresa WHERE id=$1', [buscaId])
    await c.query('DELETE FROM empresa_dados_cadastrais WHERE empresa_id=ANY($1::uuid[])', [empresas])
    await c.query('DELETE FROM grupo_importacao_empresa WHERE grupo_id=ANY($1::uuid[])', [[googleId, ...grupos]])
    await c.query('DELETE FROM grupo_importacao WHERE id=ANY($1::uuid[])', [[googleId, ...grupos]])
    await c.query('DELETE FROM empresa_origem_google WHERE empresa_id=ANY($1::uuid[])', [empresas])
    await c.query('DELETE FROM empresa_fila WHERE empresa_id=ANY($1::uuid[])', [empresas])
    await c.query('DELETE FROM empresa WHERE id=ANY($1::uuid[])', [empresas])
  })
})
test('vendedor escolhe fonte, confere contatos e importa; gestor acompanha e pausa', async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000)
  await entrar(page, 'buscavendedore2e')
  await page.goto('/fila')
  await page.getByRole('link', { name: 'Planejar buscas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Planejamento da semana',exact:true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Consultar empresas do Google', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar às opções', exact: true }).click()
  await page.getByRole('link', { name: 'Buscar novas empresas', exact: true }).click()
  await page.getByRole('link', { name: nomeBusca, exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Selecionar Somente email fictício', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Selecionar Loja iluminação fictícia CNPJ', exact: true }).check()
  await page.getByRole('button', { name: 'Importar selecionadas', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('1 empresas novas')
  const prospectar = page.getByRole('link', { name: 'Prospectar esta lista', exact: true })
  await expect(prospectar).toHaveAttribute('href', /grupo=/)
  const [{ id: empresaId }] = await comBancoGrupos(async c => (await c.query('SELECT id FROM empresa WHERE cnpj=$1', [lead.cnpj])).rows)
  await page.goto('/fila/localizar/' + empresaId)
  await expect(page.getByRole('heading', { name: 'Dados cadastrais do CNPJ.biz' })).toBeVisible()
  await expect(page.getByText('Rua fictícia, 10, Sala 2, Centro, São Paulo, SP', { exact: true })).toBeVisible()
  const contextoGestor = await browser.newContext()
  const paginaGestor = await contextoGestor.newPage()
  await entrar(paginaGestor, 'buscagestore2e')
  await paginaGestor.goto('/empresas')
  await paginaGestor.getByRole('link', { name: 'Busca de empresas', exact: true }).click()
  const form = paginaGestor.getByRole('form', { name: 'Limite de buscavendedore2e', exact: true })
  await form.getByRole('spinbutton').fill('5')
  await form.getByRole('checkbox').check()
  await form.getByRole('button', { name: 'Salvar limite', exact: true }).click()
  await expect(form.getByRole('status')).toHaveText('Limite salvo.')
  await paginaGestor.getByRole('link', { name: nomeBusca, exact: true }).click()
  await expect(paginaGestor.getByText('CNAE principal', { exact: true }).first()).toBeVisible()
  await page.goto('/fila/buscar?busca=' + buscaId)
  await expect(page.getByText('Suas buscas estão pausadas pelo gestor.', { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Selecionar Loja iluminação fictícia CNPJ', exact: true })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('buscar-empresas-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('link', { name: 'Voltar às opções', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('buscar-empresas-mobile.png'), fullPage: true })
  await contextoGestor.close()
})
