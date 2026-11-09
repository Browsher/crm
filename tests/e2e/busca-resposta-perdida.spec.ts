import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness } from './dados-grupos'

test('busca do Banco com resposta perdida é consultada no histórico após reload sem nova cobrança', async ({ page }, testInfo) => {
  const banco = bancoGruposDoHarness()
  const senha = 'Senha-e2e-2026'
  const apelido = 'bancorecuperacao-' + randomUUID().slice(0, 8)
  const { id: vendedor } = await criarUsuarioComSenha(banco, 'vendedor', apelido, senha)
  await banco.sql('INSERT INTO busca_empresa_limite(usuario_id,limite_diario) VALUES ($1,5)', [vendedor])
  const chamadas = async () => {
    const resposta = await fetch(process.env.CNPJ_BIZ_MOCK_URL + '/estatisticas')
    expect(resposta.ok).toBe(true)
    const estatisticas: { consultas: number } = await resposta.json()
    return estatisticas.consultas
  }
  const buscasDoVendedor = () => banco.sql(`SELECT id,nome,estado,fornecedor,quantidade,
    jsonb_array_length(empresas) AS retornadas,inclusao_automatica_concluida
    FROM busca_empresa WHERE usuario_id=$1`, [vendedor])

  await page.goto('/login')
  await page.getByLabel('E-mail').fill(apelido + '@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  const endereco = '/fila/buscar?fonte=banco'
  const nome = 'Consulta fictícia com resposta perdida'
  await page.goto(endereco)
  const cota = page.getByLabel('Seu limite de hoje', { exact: true })
  await expect(cota).toContainText('0 de 5 empresas solicitadas hoje. 5 disponíveis.')
  const inicial = await chamadas()
  expect(await buscasDoVendedor()).toEqual([])
  await page.getByLabel('Nome ou palavra-chave', { exact: true }).fill('iluminação')
  await page.getByRole('button', { name: 'Resultados e dados retornados', exact: true }).click()
  await page.getByLabel('Nome da lista', { exact: true }).fill(nome)
  await page.getByRole('spinbutton', { name: /^Quantidade de empresas/ }).fill('1')
  const campoChave = page.locator('input[name="chave"]')
  const chave = await campoChave.inputValue()
  let envios = 0
  await page.route('**/fila/buscar*', async rota => {
    if (rota.request().method() !== 'POST' || !rota.request().postData()?.includes(nome)) return rota.continue()
    envios++
    const resposta = await rota.fetch()
    expect(resposta.ok()).toBe(true)
    await rota.abort('failed')
  })
  const falha = page.waitForEvent('requestfailed', pedido => pedido.method() === 'POST'
    && pedido.postData()?.includes(chave) === true)
  await page.getByRole('button', { name: 'Buscar empresas', exact: true }).click()
  await falha
  const esperado = [{
    id: chave, nome, estado: 'concluida', fornecedor: 'Casa dos Dados', quantidade: 1,
    retornadas: 1, inclusao_automatica_concluida: true,
  }]
  expect(await buscasDoVendedor()).toEqual(esperado)
  expect(await chamadas()).toBe(inicial + 1)
  await expect(page).toHaveURL(endereco)

  await page.reload()
  await expect(page).toHaveURL(endereco)
  await expect(cota).toContainText('1 de 5 empresas solicitadas hoje. 4 disponíveis.')
  await expect(campoChave).not.toHaveValue(chave)
  await expect(page.getByRole('dialog', { name: nome, exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Histórico de buscas', exact: true }).click()
  await page.getByRole('button', { name: 'Ver empresas: ' + nome, exact: true }).click()
  const recibo = page.getByRole('dialog', { name: nome, exact: true })
  await expect(recibo).toBeVisible()
  await expect(recibo).toContainText('Casa dos Dados')
  await expect(recibo).toContainText('1 solicitadas · 1 retornadas')
  await expect(recibo.getByText('Concluída', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(endereco)
  expect(envios).toBe(1)
  expect(await buscasDoVendedor()).toEqual(esperado)
  expect(await chamadas()).toBe(inicial + 1)
  await page.screenshot({ path: testInfo.outputPath('busca-recuperada-no-historico.png'), fullPage: true })
})

test('resultado que chega com o Histórico aberto toma a lateral e seleciona Buscar', async ({ page }) => {
  const banco = bancoGruposDoHarness()
  const apelido = 'bancolateral-' + randomUUID().slice(0, 8)
  const senha = 'Senha-e2e-2026'
  const { id: vendedor } = await criarUsuarioComSenha(banco, 'vendedor', apelido, senha)
  const anterior = 'Busca salva antes do envio'
  const nova = 'Resultado recebido com histórico aberto'
  await banco.sql('INSERT INTO busca_empresa_limite(usuario_id,limite_diario) VALUES ($1,5)', [vendedor])
  await banco.sql(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas)
    VALUES ($1,$2,$3,1,'concluida','[]')`, [vendedor, anterior, JSON.stringify({ palavra: 'anterior', cidade: 'São Paulo', uf: 'SP', quantidade: 1, offset: 0 })])

  await page.goto('/login')
  await page.getByLabel('E-mail').fill(apelido + '@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/fila/buscar?fonte=banco')
  await page.getByLabel('Nome ou palavra-chave', { exact: true }).fill('iluminação')
  await page.getByRole('button', { name: 'Resultados e dados retornados', exact: true }).click()
  await page.getByLabel('Nome da lista', { exact: true }).fill(nova)
  await page.getByRole('spinbutton', { name: /^Quantidade de empresas/ }).fill('1')
  const chave = await page.locator('input[name="chave"]').inputValue()
  const busca = page.getByRole('tab', { name: 'Buscar empresas', exact: true })
  const historico = page.getByRole('tab', { name: 'Histórico de buscas', exact: true })
  let liberar!: () => void
  const pendente = new Promise<void>(resolve => { liberar = resolve })
  await page.route('**/fila/buscar*', async rota => {
    if (rota.request().method() === 'POST' && rota.request().postData()?.includes(chave)) await pendente
    await rota.continue()
  })
  try {
    const pedido = page.waitForRequest(r => r.method() === 'POST' && r.postData()?.includes(chave) === true)
    await page.getByRole('button', { name: 'Buscar empresas', exact: true }).click()
    await pedido
    await historico.click()
    await page.getByRole('button', { name: 'Filtros usados: ' + anterior, exact: true }).click()
    const filtros = page.getByRole('dialog', { name: 'Filtros usados', exact: true })
    await expect(filtros).toContainText('anterior')
    await page.evaluate(() => {
      const atualizar = () => {
        const atual = document.querySelectorAll('[data-painel-lateral]').length
        document.body.dataset.maximoPaineis = String(Math.max(atual, Number(document.body.dataset.maximoPaineis ?? '0')))
      }
      atualizar()
      new MutationObserver(atualizar).observe(document.body, { subtree: true, childList: true })
    })
  } finally {
    liberar()
  }

  await expect(page).toHaveURL(url => url.searchParams.get('busca') === chave)
  const resultado = page.getByRole('dialog', { name: nova, exact: true })
  const gatilho = page.getByRole('button', { name: 'Ver resultados: ' + nova, exact: true })
  await expect(resultado).toContainText('1 solicitadas · 1 retornadas')
  await expect(page.locator('[data-painel-lateral]')).toHaveCount(1)
  await expect(page.locator('body')).toHaveAttribute('data-maximo-paineis', '1')
  await expect(resultado.getByRole('heading', { name: nova, exact: true })).toBeFocused()
  await resultado.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(busca).toHaveAttribute('aria-selected', 'true')
  await expect(gatilho).toBeFocused()
  await historico.click()
  await expect(page.getByRole('button', { name: 'Filtros usados: ' + anterior, exact: true })).toBeVisible()
  await expect(page.locator('[data-painel-lateral]')).toHaveCount(0)
  await busca.click()
  await expect(page.locator('[data-painel-lateral]')).toHaveCount(0)
  await expect(page).toHaveURL(url => url.searchParams.get('busca') === chave)
})
