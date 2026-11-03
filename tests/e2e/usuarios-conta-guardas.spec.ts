import { randomBytes } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { vincularEmpresaTeste } from '../integracao/atendimento-fixtures'
import { bancoGruposDoHarness } from './dados-grupos'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

const banco = bancoGruposDoHarness()
const senhaFicticia = () => randomBytes(24).toString('base64url')

async function entrar(page: Page, apelido: string, senha: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(apelido + '@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

async function entrarGestor(page: Page, apelido: string) {
  const senha = senhaFicticia()
  await criarUsuarioComSenha(banco, 'gestor', apelido, senha)
  await entrar(page, apelido, senha)
  await expect(page).toHaveURL('/gestao')
}

test('G07 mantém três filtros e página da lista ao voltar do perfil e recarregar', async ({ page }) => {
  await entrarGestor(page, 't8gestorrecorte')
  await banco.sql(`INSERT INTO usuario (nome, email, papel)
    SELECT 't8recorte ' || lpad(i::text, 2, '0'), 't8recorte' || i || '@teste.local', 'vendedor'
    FROM generate_series(1, 27) i`)
  await page.goto('/usuarios')
  await page.getByLabel('Buscar usuário').fill('t8recorte')
  await page.getByRole('combobox', { name: 'Papel', exact: true }).selectOption('vendedor')
  await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('ativos')
  await page.getByRole('link', { name: 'Próxima', exact: true }).click()
  await expect(page).toHaveURL('/usuarios?busca=t8recorte&papel=vendedor&situacao=ativos&pagina=2')
  await page.getByRole('link', { name: 'Ver perfil de t8recorte 26' }).click()
  await expect(page.getByRole('heading', { name: 't8recorte 26', exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('link', { name: 'Voltar para Usuários' }).click()
  await expect(page.getByText('Página 2 de 2')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Buscar usuário')).toHaveValue('t8recorte')
  await expect(page.getByRole('combobox', { name: 'Papel', exact: true })).toHaveValue('vendedor')
  await expect(page.getByRole('combobox', { name: 'Situação', exact: true })).toHaveValue('ativos')
  await expect(page.getByRole('row').filter({ hasText: 't8recorte 26' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 't8recorte 01' })).toHaveCount(0)
})


test('G07 link lateral limpa recorte de Usuários e Voltar restaura filtros e linhas', async ({ page }) => {
  const termo = 'recortelateral-' + randomBytes(5).toString('hex')
  await entrarGestor(page, termo + '-gestor')
  const nome = termo + ' vendedor'
  const { id } = await criarUsuarioComSenha(banco, 'vendedor', termo + '-vendedor', senhaFicticia())
  await banco.sql('UPDATE usuario SET nome=$2 WHERE id=$1', [id, nome])
  await page.goto('/usuarios')
  const busca = page.getByLabel('Buscar usuário')
  const papel = page.getByRole('combobox', { name: 'Papel', exact: true })
  const situacao = page.getByRole('combobox', { name: 'Situação', exact: true })
  const linhas = page.getByRole('table', { name: 'Acessos da equipe' }).getByRole('row')
  const totalInicial = await linhas.count()
  expect(totalInicial).toBeGreaterThan(2)
  await busca.fill(termo)
  await busca.press('End')
  await busca.press('Space')
  await expect(busca).toHaveValue(termo + ' ')
  await busca.pressSequentially('vendedor')
  await expect(busca).toBeFocused()
  await expect(busca).toHaveValue(nome)
  await papel.selectOption('vendedor')
  await situacao.selectOption('ativos')
  const recorte = '/usuarios?' + new URLSearchParams({ busca: nome, papel: 'vendedor', situacao: 'ativos' })
  await expect(page).toHaveURL(recorte)
  await expect(linhas).toHaveCount(2)
  await expect(linhas.last()).toContainText(nome)

  await page.getByRole('navigation', { name: 'Navegação do CRM' }).getByRole('link', { name: 'Usuários', exact: true }).click()
  await expect(page).toHaveURL('/usuarios')
  await expect(busca).toHaveValue('')
  await expect(papel).toHaveValue('todos')
  await expect(situacao).toHaveValue('todos')
  await expect(linhas).toHaveCount(totalInicial)

  await page.evaluate(() => history.back())
  await expect(page).toHaveURL(recorte)
  await expect(busca).toHaveValue(nome)
  await expect(papel).toHaveValue('vendedor')
  await expect(situacao).toHaveValue('ativos')
  await expect(linhas).toHaveCount(2)
  await expect(linhas.last()).toContainText(nome)
})

test('conta fictícia permite sair durante troca obrigatória e voltar com proteção na voluntária', async ({ page }) => {
  const provisoria = senhaFicticia()
  const definitiva = senhaFicticia()
  await criarUsuarioComSenha(banco, 'vendedor', 't8contaficticia', provisoria, { pendente: true })
  await entrar(page, 't8contaficticia', provisoria)
  await expect(page).toHaveURL('/trocar-senha')
  await expect(page.getByRole('link', { name: 'Voltar ao CRM' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await entrar(page, 't8contaficticia', provisoria)
  await expect(page).toHaveURL('/trocar-senha')
  await page.getByLabel('Senha atual').fill(provisoria)
  await page.getByLabel('Nova senha').fill(definitiva)
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.getByRole('link', { name: 'Trocar senha' }).click()
  await page.getByLabel('Senha atual').fill(definitiva)
  await page.getByRole('link', { name: 'Voltar ao CRM' }).click()
  await expect(page.getByRole('heading', { name: 'Descartar alterações?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(page).toHaveURL('/trocar-senha')
  await page.getByLabel('Senha atual').clear()
  await page.getByRole('link', { name: 'Voltar ao CRM' }).click()
  await expect(page).toHaveURL('/meu-dia')
})

test('C04 logout lento trava repetição e falha de rede preserva a saída recuperável', async ({ page }) => {
  await entrarGestor(page, 't8gestorsaida')
  let liberar!: () => void
  const aguardando = new Promise<void>(resolve => { liberar = resolve })
  let envios = 0
  await page.route('**/sair', async rota => {
    expect(rota.request().method()).toBe('POST')
    if (++envios === 1) {
      await aguardando
      await rota.abort('failed')
    } else await rota.continue()
  })
  try {
    await page.getByRole('button', { name: 'Sair', exact: true }).click()
    const pendente = page.getByRole('button', { name: 'Saindo…', exact: true })
    await expect(pendente).toBeDisabled()
    await pendente.evaluate((botao: HTMLButtonElement) => botao.click())
    expect(envios).toBe(1)
  } finally { liberar() }
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível confirmar a saída' })).toBeVisible()
  await expect(page).toHaveURL('/gestao')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL('/login')
  expect(envios).toBe(2)
})

test('G09 erro antes da escrita mantém limite e pausa para conferência', async ({ page }) => {
  await entrarGestor(page, 't8gestorlimite')
  const alvo = await criarUsuarioComSenha(banco, 'vendedor', 't8limitealvo', senhaFicticia())
  await banco.sql(`CREATE FUNCTION t8_falha_limite() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'falha sintética antes do limite'; END $$`)
  await banco.sql(`CREATE TRIGGER t8_falha_limite BEFORE INSERT OR UPDATE ON busca_empresa_limite
    FOR EACH ROW WHEN (NEW.usuario_id = '${alvo.id}'::uuid) EXECUTE FUNCTION t8_falha_limite()`)
  try {
    await page.goto('/empresas/busca')
    const formulario = page.getByRole('form', { name: 'Limite de t8limitealvo', exact: true })
    await formulario.getByLabel('Limite diário', { exact: false }).fill('123')
    await formulario.getByLabel('Pausar buscas', { exact: false }).check()
    await formulario.getByRole('button', { name: 'Salvar limite' }).click()
    await expect(formulario.getByRole('alert')).toBeVisible()
    await expect(formulario.getByLabel('Limite diário', { exact: false })).toHaveValue('123')
    await expect(formulario.getByLabel('Pausar buscas', { exact: false })).toBeChecked()
    expect(await banco.sql('SELECT 1 FROM busca_empresa_limite WHERE usuario_id=$1', [alvo.id])).toHaveLength(0)
    await expect(formulario.getByRole('alert')).toContainText('confira')
  } finally { await banco.sql('DROP TRIGGER t8_falha_limite ON busca_empresa_limite') }
  page.once('dialog', dialogo => dialogo.accept())
  await page.reload()
  const formulario = page.getByRole('form', { name: 'Limite de t8limitealvo', exact: true })
  await expect(formulario.getByRole('spinbutton')).toHaveValue('0')
  await formulario.getByRole('spinbutton').fill('123')
  await formulario.getByRole('checkbox').check()
  await formulario.getByRole('button', { name: 'Salvar limite' }).click()
  await expect(formulario.getByRole('status')).toContainText('Limite salvo')
  expect(await banco.sql('SELECT limite_diario, pausado FROM busca_empresa_limite WHERE usuario_id=$1', [alvo.id]))
    .toEqual([{ limite_diario: 123, pausado: true }])
})

test('G10 erro antes do insert de usuário preserva edição e orienta conferir', async ({ page }) => {
  await entrarGestor(page, 't8gestorusuarios')
  const email = 't8criacaofalha@teste.local'
  await banco.sql(`CREATE FUNCTION t8_falha_usuario() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'falha sintética antes do usuário'; END $$`)
  await banco.sql(`CREATE TRIGGER t8_falha_usuario BEFORE INSERT ON usuario
    FOR EACH ROW WHEN (NEW.email = '${email}') EXECUTE FUNCTION t8_falha_usuario()`)
  try {
    await page.goto('/usuarios')
    await page.getByRole('button', { name: 'Novo usuário' }).click()
    const dialogo = page.getByRole('dialog')
    await dialogo.getByLabel('Nome', { exact: true }).fill('Pessoa fictícia Task 8')
    await dialogo.getByLabel('E-mail', { exact: true }).fill(email)
    await dialogo.getByRole('radio', { name: 'Gestor', exact: true }).check()
    await dialogo.getByRole('button', { name: 'Criar usuário' }).click()
    await expect(dialogo.getByRole('alert')).toContainText('confira')
    await expect(dialogo.getByLabel('E-mail', { exact: true })).toHaveValue(email)
    await expect(dialogo.getByRole('radio', { name: 'Gestor', exact: true })).toBeChecked()
    expect(await banco.sql('SELECT 1 FROM usuario WHERE email=$1', [email])).toHaveLength(0)
  } finally { await banco.sql('DROP TRIGGER t8_falha_usuario ON usuario') }
})

test('G10 resposta perdida após criar preserva edição sem incentivar nova criação', async ({ page }) => {
  await entrarGestor(page, 't8gestorresposta')
  const email = 't8criadosemresposta@teste.local'
  await page.goto('/usuarios')
  await page.route('**/usuarios', async rota => {
    if (!rota.request().headers()['next-action']) return rota.continue()
    const resposta = await rota.fetch()
    expect(resposta.ok()).toBeTruthy()
    await rota.abort('failed')
  })
  await page.getByRole('button', { name: 'Novo usuário' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nome', { exact: true }).fill('Pessoa fictícia resposta perdida')
  await dialogo.getByLabel('E-mail', { exact: true }).fill(email)
  await dialogo.getByRole('button', { name: 'Criar usuário' }).click()
  await expect(dialogo.getByRole('alert')).toContainText('confira')
  await expect(dialogo.getByLabel('E-mail', { exact: true })).toHaveValue(email)
  expect(await banco.sql('SELECT 1 FROM usuario WHERE email=$1', [email])).toHaveLength(1)
  await expect(dialogo.getByRole('button', { name: 'Criar usuário' })).toBeDisabled()
})


test('guardas administrativas usam a edição real para Cancelar, Escape e Voltar', async ({ page }) => {
  await entrarGestor(page, 't8gestorguardas')
  const alvo = await criarUsuarioComSenha(banco, 'vendedor', 't8guardasalvo', senhaFicticia())
  const [{ id }] = await banco.sql<{ id: string }>(
    'INSERT INTO grupo_importacao (nome, descricao, origem) VALUES ($1,$2,$3) RETURNING id',
    ['Grupo fictício Task 8', 'Resumo original', 'Origem fictícia'],
  )
  await page.goto('/empresas/grupos/' + id)
  await page.getByText('Corrigir contexto da lista', { exact: true }).click()
  const resumo = page.getByRole('textbox', { name: 'Resumo da lista', exact: true })
  await resumo.fill('Edição descartável')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Descartar alterações?' })).toBeVisible()
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click()
  await expect(resumo).toBeHidden()
  await page.getByText('Corrigir contexto da lista', { exact: true }).click()
  await expect(resumo).toHaveValue('Resumo original')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(resumo).toBeHidden()

  await page.goto('/empresas/busca')
  const limite = page.getByRole('form', { name: 'Limite de t8guardasalvo', exact: true })
  const quantidade = limite.getByRole('spinbutton')
  await quantidade.fill('38')
  await limite.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Descartar alterações?' })).toBeVisible()
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click()
  await expect(quantidade).toHaveValue('0')

  await page.goto('/whatsapp/configuracao')
  await page.getByLabel('Vendedor ativo').selectOption(alvo.id)
  await page.getByRole('link', { name: 'Voltar ao WhatsApp' }).click()
  await expect(page.getByRole('heading', { name: 'Descartar alterações?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(page.getByLabel('Vendedor ativo')).toHaveValue(alvo.id)
  await page.getByLabel('Vendedor ativo').selectOption('')
  await page.getByRole('link', { name: 'Voltar ao WhatsApp' }).click()
  await expect(page).toHaveURL('/whatsapp')
})


test('Voltar do navegador pede descarte uma vez com dois editores alterados', async ({ page }) => {
  await entrarGestor(page, 't8gestorhistorico')
  await criarUsuarioComSenha(banco, 'vendedor', 't8historicoalvo1', senhaFicticia())
  await criarUsuarioComSenha(banco, 'vendedor', 't8historicoalvo2', senhaFicticia())
  await page.goto('/empresas/busca')
  const primeiro = page.getByRole('form', { name: 'Limite de t8historicoalvo1', exact: true }).getByRole('spinbutton')
  const segundo = page.getByRole('form', { name: 'Limite de t8historicoalvo2', exact: true }).getByRole('spinbutton')
  await primeiro.fill('35')
  await segundo.fill('72')
  await page.evaluate(() => history.back())
  const aviso = page.getByRole('heading', { name: 'Descartar alterações?' })
  await expect(aviso).toBeVisible()
  await page.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(primeiro).toHaveValue('35')
  await expect(segundo).toHaveValue('72')
  await page.evaluate(() => history.back())
  await expect(aviso).toBeVisible()
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click()
  await expect(page).toHaveURL('/gestao')
})

test('G09 resposta perdida após gravar limite orienta conferência sem novo envio', async ({ page }) => {
  await entrarGestor(page, 't8gestorlimiteresposta')
  const alvo = await criarUsuarioComSenha(banco, 'vendedor', 't8limiterespostaalvo', senhaFicticia())
  await page.goto('/empresas/busca')
  await page.route('**/empresas/busca', async rota => {
    if (!rota.request().headers()['next-action']) return rota.continue()
    expect((await rota.fetch()).ok()).toBeTruthy()
    await rota.abort('failed')
  })
  const formulario = page.getByRole('form', { name: 'Limite de t8limiterespostaalvo', exact: true })
  await formulario.getByRole('spinbutton').fill('90')
  await formulario.getByRole('checkbox').check()
  await formulario.getByRole('button', { name: 'Salvar limite' }).click()
  await expect(formulario.getByRole('alert')).toContainText('confira')
  await expect(formulario.getByRole('spinbutton')).toHaveValue('90')
  await expect(formulario.getByRole('checkbox')).toBeChecked()
  expect(await banco.sql('SELECT limite_diario, pausado FROM busca_empresa_limite WHERE usuario_id=$1', [alvo.id]))
    .toEqual([{ limite_diario: 90, pausado: true }])
  await expect(formulario.getByRole('button', { name: 'Salvar limite' })).toBeDisabled()
})

test('G10 falha antes da escrita de metadados preserva contexto no editor', async ({ page }) => {
  await entrarGestor(page, 't8gestorgrupofalha')
  const [{ id }] = await banco.sql<{ id: string }>(
    'INSERT INTO grupo_importacao (nome, descricao, origem) VALUES ($1,$2,$3) RETURNING id',
    ['Grupo fictício para falha', 'Resumo original', 'Origem fictícia'],
  )
  await banco.sql(`CREATE FUNCTION t8_falha_grupo() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'falha sintética antes do contexto'; END $$`)
  await banco.sql(`CREATE TRIGGER t8_falha_grupo BEFORE UPDATE ON grupo_importacao
    FOR EACH ROW WHEN (NEW.id = '${id}'::uuid) EXECUTE FUNCTION t8_falha_grupo()`)
  try {
    await page.goto('/empresas/grupos/' + id)
    await page.getByText('Corrigir contexto da lista', { exact: true }).click()
    const resumo = page.getByRole('textbox', { name: 'Resumo da lista', exact: true })
    await resumo.fill('Contexto fictício novo')
    await page.getByRole('button', { name: 'Salvar contexto', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Contexto da lista' }).getByRole('alert')).toContainText('confira')
    await expect(resumo).toHaveValue('Contexto fictício novo')
    expect(await banco.sql('SELECT descricao FROM grupo_importacao WHERE id=$1', [id])).toEqual([{ descricao: 'Resumo original' }])
  } finally { await banco.sql('DROP TRIGGER t8_falha_grupo ON grupo_importacao') }
})

test('C01 no celular, breadcrumb de Atendimento volta por teclado ao recorte Sem interesse', async ({ page }) => {
  const senha = senhaFicticia()
  const vendedor = await criarUsuarioComSenha(banco, 'vendedor', 't8trilhavendedor', senha)
  const [{ id }] = await banco.sql<{ id: string }>(
    'INSERT INTO empresa (razao_social,telefone) VALUES ($1,$2) RETURNING id',
    ['Empresa fictícia da trilha', '11911110000'],
  )
  await vincularEmpresaTeste(banco, id, vendedor.id, 'legado')
  await page.setViewportSize({ width: 390, height: 844 })
  await entrar(page, 't8trilhavendedor', senha)
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/fila/sem-interesse')
  const trilha = page.getByRole('navigation', { name: 'Localização atual' })
  await expect(trilha.getByText('Sem interesse', { exact: true })).toHaveAttribute('aria-current', 'page')
  await page.goto('/fila/atendimento/' + id + '?disponibilidade=sem_interesse&pagina=2')
  await expect(trilha.getByText('Atendimento', { exact: true })).toHaveAttribute('aria-current', 'page')
  await trilha.getByRole('link', { name: 'Sem interesse', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/fila/localizar?disponibilidade=sem_interesse&pagina=2&pesquisado=1')
})
