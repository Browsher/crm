import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness, comBancoGrupos } from './dados-grupos'

const id = randomUUID(), vazio = randomUUID(), reservado = randomUUID(), falhou = randomUUID(), alheio = randomUUID()
const nome = 'Pop-up · busca detalhada fictícia'
let vendedor: string
const empresa = { cnpj: '87654321000198', razao_social: 'Empresa detalhada fictícia LTDA', nome_fantasia: 'Armarinhos do pop-up fictícios',
  telefone: '11970001234', telefones: ['11970001234', '1131001234'], email: 'popup@empresa.test', cep: '01001000', cnae_principal: '4755502',
  situacao: 'ATIVA', porte: 'ME', data_abertura: '2020-01-15', logradouro: 'Rua de teste', numero: '10', complemento: 'Sala 2', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP',
  detalhes: { capital_social: '10000.00', natureza_juridica: 'Sociedade limitada', atividades_secundarias: ['4781400'], regime_tributario: ['Simples Nacional'], socios: [{ nome: 'Sócio fictício popup', funcao: { descricao: 'Administrador' }, cnpj_cpf_socio: '***111222**', representante_legal: { nome: 'Representante reservado popup', cpf: '***333444**' } }] } }
const filtros = { palavra: 'armarinhos', cnae: '', uf: 'SP', cidade: 'São Paulo', bairro: 'Centro', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 2, offset: 0 }
async function entrar(page: Page, apelido = 'popupvendedore2e') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(apelido + '@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(apelido === 'gestore2e' ? '/gestao' : '/meu-dia')
}
const chamadas = async () => (await (await fetch(process.env.CNPJ_BIZ_MOCK_URL + '/estatisticas')).json()).consultas

test.beforeAll(async () => {
  const banco = bancoGruposDoHarness()
  vendedor = (await criarUsuarioComSenha(banco, 'vendedor', 'popupvendedore2e', 'Senha-e2e-2026')).id
  const outro = (await criarUsuarioComSenha(banco, 'vendedor', 'popupoutroe2e', 'Senha-e2e-2026')).id
  await banco.sql('INSERT INTO busca_empresa_limite(usuario_id,limite_diario) VALUES ($1,100)', [vendedor])
  await comBancoGrupos(async c => {
    await c.query('BEGIN')
    try {
      await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('role','app_usuario',true)", [vendedor])
      await c.query('SELECT busca_empresa_reservar_casa($1,$2,$3)', [id, nome, JSON.stringify(filtros)])
      await c.query('SELECT busca_empresa_concluir($1,$2,NULL)', [id, JSON.stringify([empresa, { ...empresa, cnpj: '87654321000279', razao_social: 'Sem telefone popup fictícia', nome_fantasia: null, email: 'semtelefone-popup@empresa.test', telefone: null, telefones: [], detalhes: {} }])])
      await c.query('COMMIT')
    } catch (e) { await c.query('ROLLBACK'); throw e }
  })
  for (const [chave, titulo, estado, motivo, dono] of [[vazio, 'Pop-up sem empresas', 'concluida', null, vendedor], [reservado, 'Pop-up processando', 'reservada', null, vendedor], [falhou, 'Pop-up com falha', 'falhou', 'sem_creditos', vendedor], [alheio, 'Busca privada do outro vendedor', 'concluida', null, outro]] as const) {
    await banco.sql('INSERT INTO busca_empresa(id,usuario_id,nome,filtros,quantidade,estado,motivo,empresas) VALUES($1,$2,$3,$4,2,$5,$6,$7)', [chave, dono, titulo, JSON.stringify(filtros), estado, motivo, '[]'])
  }
})

test('histórico abre sem navegação ou nova coleta; cards, foco, temas e celular', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await entrar(page)
  await page.goto('/fila/buscar?fonte=banco')
  await page.getByLabel('Nome ou palavra-chave', { exact: true }).fill('Rascunho preservado')
  const antes = await chamadas()
  const url = page.url()
  await page.getByRole('tab', { name: 'Histórico de buscas', exact: true }).click()
  const gatilho = page.getByRole('button', { name: 'Ver empresas: ' + nome, exact: true })
  await gatilho.click()
  const popup = page.getByRole('dialog', { name: nome, exact: true })
  await expect(popup).toHaveAttribute('data-slot', 'painel-lateral-content')
  await expect(popup.getByRole('heading', { name: empresa.nome_fantasia, exact: true })).toBeVisible()
  await expect(page).toHaveURL(url)
  const verEmpresa = popup.getByRole('button', { name: 'Ver empresa: ' + empresa.nome_fantasia, exact: true })
  const corpo = popup.locator('[data-painel-corpo]')
  await verEmpresa.scrollIntoViewIfNeeded()
  await corpo.evaluate(el => { el.scrollTop = 180 })
  const rolagem = await corpo.evaluate(el => el.scrollTop)
  expect(rolagem).toBeGreaterThan(0)
  await verEmpresa.evaluate(el => el.focus({ preventScroll: true }))
  await page.keyboard.press('Enter')
  const detalhe = page.getByRole('dialog', { name: 'Ver empresa', exact: true })
  await expect(page.locator('[data-painel-lateral]')).toHaveCount(1)
  for (const [grupo, textos] of [['Contato e localização', ['01001-000']], ['Cadastro e origem', ['15/01/2020']], ['Atividades e sócios', ['Administrador', '4781400']]] as const) {
    const item = detalhe.getByRole('button', { name: grupo, exact: true })
    await item.click()
    for (const texto of textos) await expect(detalhe.getByText(texto, { exact: true }).first()).toBeVisible()
    await expect(detalhe).not.toContainText('***111222**')
    await expect(detalhe).not.toContainText('Representante reservado popup')
    await detalhe.getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(item).toBeFocused()
  }
  await page.keyboard.press('Escape')
  await expect(verEmpresa).toBeFocused()
  await expect.poll(() => corpo.evaluate(el => el.scrollTop)).toBe(rolagem)
  for (const tema of ['light', 'dark']) {
    await popup.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
    await gatilho.click()
    await verEmpresa.click()
    for (const width of [1920, 390]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 844 })
      await expect.poll(() => detalhe.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0)
      const caixa = await detalhe.boundingBox()
      expect(caixa!.width).toBe(width === 1920 ? 520 : width)
      expect(caixa!.x).toBe(width - caixa!.width)
      const titulo = await detalhe.getByRole('heading', { name: 'Ver empresa', exact: true }).boundingBox()
      const fechar = await detalhe.getByRole('button', { name: 'Voltar', exact: true }).boundingBox()
      expect(titulo!.x + titulo!.width).toBeLessThanOrEqual(fechar!.x)
      await page.screenshot({ path: testInfo.outputPath(`busca-lateral-${width}-${tema}.png`) })
    }
    await page.keyboard.press('Escape')
    await expect(verEmpresa).toBeFocused()
  }
  await page.keyboard.press('Escape')
  await expect(popup).not.toBeVisible()
  await expect(gatilho).toBeFocused()
  await expect(page.getByRole('button', { name: 'Ver empresas: Busca privada do outro vendedor', exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Buscar empresas', exact: true }).click()
  await expect(page.getByLabel('Nome ou palavra-chave', { exact: true })).toHaveValue('Rascunho preservado')
  expect(await chamadas()).toBe(antes)
})

test('vazio, processamento e falha exibem a busca salva, sem consumir consulta', async ({ page }) => {
  await entrar(page); await page.goto('/fila/buscar')
  await page.getByRole('tab', { name: 'Histórico de buscas', exact: true }).click()
  const antes = await chamadas()
  for (const [titulo, texto] of [['Pop-up sem empresas', 'Nenhuma empresa encontrada'], ['Pop-up processando', 'Consulta em processamento ou sem confirmação'], ['Pop-up com falha', 'créditos']]) {
    await page.getByRole('button', { name: 'Ver empresas: ' + titulo, exact: true }).click()
    const popup = page.getByRole('dialog', { name: titulo, exact: true })
    await expect(popup).toContainText(texto)
    await expect(popup.getByRole('button', { name: 'Filtros usados', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    const abrirFiltros = page.getByRole('button', { name: 'Filtros usados: ' + titulo, exact: true })
    await abrirFiltros.click()
    const filtros = page.getByRole('dialog', { name: 'Filtros usados', exact: true })
    await expect(filtros).toHaveAttribute('data-slot', 'painel-lateral-content')
    await expect(filtros.getByText('Centro', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(abrirFiltros).toBeFocused()
  }
  expect(await chamadas()).toBe(antes)
})

test('inclusão e pausa preservadas; gestor vê dados restritos na lateral', async ({ page, browser }) => {
  test.setTimeout(90_000)
  await entrar(page); await page.goto('/fila/buscar')
  await page.getByRole('tab', { name: 'Histórico de buscas', exact: true }).click()
  await page.getByRole('button', { name: 'Ver empresas: ' + nome, exact: true }).click()
  const popup = page.getByRole('dialog', { name: nome, exact: true })
  await expect(popup.getByRole('checkbox')).toHaveCount(0)
  const antes = await chamadas()
  await expect(popup.getByRole('button', { name: 'Iniciar atendimento', exact: true })).toHaveCount(0)
  let liberar!: () => void
  const aguardar = new Promise<void>(resolve => { liberar = resolve })
  let interceptado = false
  await page.route('**/fila/buscar*', async route => {
    const pedido = route.request()
    if (!interceptado && pedido.method() === 'POST' && pedido.postData()?.includes(id)) {
      interceptado = true
      await aguardar
    }
    await route.continue()
  })
  try {
    await popup.locator('[data-painel-rodape]').getByRole('button', { name: 'Concluir inclusão', exact: true }).click()
    await expect.poll(() => interceptado).toBe(true)
    await expect(popup.getByRole('button', { name: 'Incluindo empresas…', exact: true })).toBeDisabled()
    const verEmpresa = popup.getByRole('button', { name: 'Ver empresa: ' + empresa.nome_fantasia, exact: true })
    await verEmpresa.click()
    const empresaDuranteInclusao = page.getByRole('dialog', { name: 'Ver empresa', exact: true })
    await expect(empresaDuranteInclusao).toBeVisible()
    await empresaDuranteInclusao.getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(verEmpresa).toBeFocused()
    await expect(popup.getByRole('button', { name: 'Incluindo empresas…', exact: true })).toBeDisabled()
  } finally {
    liberar()
  }
  await expect(popup.getByText('1 empresas novas. A lista reúne 1 empresas.', { exact: true })).toBeVisible()
  await expect(popup.getByRole('link', { name: 'Prospectar esta lista', exact: true })).toHaveCount(0)
  await expect(popup.getByRole('link', { name: 'Localizar minhas empresas', exact: true })).toHaveAttribute('href', '/fila/localizar?origem=banco')
  const incluida = popup.getByRole('listitem').filter({ has: page.getByRole('heading', { name: empresa.nome_fantasia, exact: true }) })
  await expect(incluida).toContainText('87.654.321/0001-98')
  await expect(incluida).toContainText('A contatar')
  await expect(incluida.getByRole('button', { name: 'Iniciar atendimento', exact: true })).toBeVisible()
  expect(await popup.evaluate(el => el.contains(document.activeElement))).toBe(true)
  expect(await chamadas()).toBe(antes)
  const contexto = await browser.newContext()
  try {
    const gestor = await contexto.newPage(); await entrar(gestor, 'gestore2e'); await gestor.goto('/empresas/busca')
    await gestor.getByRole('button', { name: 'Ver empresas: ' + nome, exact: true }).click()
    const detalhes = gestor.getByRole('dialog', { name: nome, exact: true })
    await expect(detalhes).toHaveAttribute('data-slot', 'painel-lateral-content')
    await expect(detalhes.getByText('***111222**', { exact: true })).toBeVisible()
    await expect(detalhes.getByText('Representante reservado popup', { exact: true })).toBeVisible()
    await expect(detalhes.getByRole('button', { name: 'Importar selecionadas', exact: true })).toHaveCount(0)
    await gestor.keyboard.press('Escape')
    const limite = gestor.getByRole('form', { name: 'Limite de popupvendedore2e', exact: true })
    await limite.getByRole('checkbox').check(); await limite.getByRole('button', { name: 'Salvar limite', exact: true }).click()
    await expect(limite.getByRole('status')).toHaveText('Limite salvo.')
    await page.reload(); await page.getByRole('tab', { name: 'Histórico de buscas', exact: true }).click(); await page.getByRole('button', { name: 'Ver empresas: ' + nome, exact: true }).click()
    await expect(popup).toContainText('Inclusões pausadas pelo gestor')
    await expect(popup.getByRole('checkbox')).toHaveCount(0)
    const ver = popup.getByRole('button', { name: 'Ver empresa: ' + empresa.nome_fantasia, exact: true })
    await expect(ver).toBeEnabled(); await ver.click()
    const detalhe = page.getByRole('dialog', { name: 'Ver empresa', exact: true })
    await detalhe.getByRole('button', { name: 'Contato e localização', exact: true }).click()
    await expect(detalhe.getByText('01001-000', { exact: true })).toBeVisible()
  } finally { await contexto.close() }
})
