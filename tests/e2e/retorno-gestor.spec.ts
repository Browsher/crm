import { expect, test, type Page } from '@playwright/test'
import { comBancoGrupos } from './dados-grupos'

const arquivo = '/empresas/arquivadas'
const filtro = 'Arquivo contextual fictício'
const semana = '2026-10-12'
const nicho = 'Coleta contextual fictícia'
const nomeEmpresa = 'Resultado contextual da segunda página'
let coletaId: string
let vendedorId: string

async function entrarGestor(page: Page) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/gestao')
}

async function conferirRecorte(page: Page, caminho: string, filtros: Record<string, string | null>) {
  await expect.poll(() => {
    const url = new URL(page.url())
    return [url.pathname, ...Object.keys(filtros).map(chave => url.searchParams.get(chave))]
  }).toEqual([caminho, ...Object.values(filtros)])
}

test.beforeAll(async () => {
  await comBancoGrupos(async cliente => {
    const { rows: [existente] } = await cliente.query('SELECT id,vendedor_id FROM google_planejamento WHERE nicho=$1 AND dia=$2', [nicho, semana])
    if (existente) {
      coletaId = existente.id
      vendedorId = existente.vendedor_id
      return
    }
    await cliente.query('BEGIN')
    try {
      const { rows: [{ id: operacao }] } = await cliente.query(
        "INSERT INTO arquivo_legado_operacao(manifesto,assinatura,backup_sha256) VALUES('{}',$1,$2) RETURNING id",
        ['d'.repeat(64), 'e'.repeat(64)],
      )
      // O gatilho de auditoria usa now() para todo INSERT. Os IDs ordenam
      // as 51 listas da mesma transação pelo desempate real da consulta.
      const { rows: [grupo] } = await cliente.query(`WITH g AS (
        INSERT INTO grupo_importacao(id,nome,ativo)
        SELECT ('406a0000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
          'Lista contextual ' || n, false FROM generate_series(1,51) n
        RETURNING id,nome
      ) SELECT id FROM g WHERE nome='Lista contextual 51'`)
      const { rows: [empresa] } = await cliente.query(`WITH e AS (
        INSERT INTO empresa(razao_social,telefone)
        SELECT $1 || ' ' || lpad(n::text,2,'0'), '11999992' || lpad(n::text,3,'0') FROM generate_series(1,51) n
        RETURNING id,razao_social
      ) SELECT id FROM e WHERE razao_social=$1 || ' 51'`, [filtro])
      await cliente.query('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [grupo.id, empresa.id])
      await cliente.query("INSERT INTO grupo_importacao_arquivo(grupo_id,operacao_id) SELECT id,$1 FROM grupo_importacao WHERE nome LIKE 'Lista contextual %'", [operacao])
      await cliente.query("INSERT INTO empresa_arquivo(empresa_id,operacao_id) SELECT id,$1 FROM empresa WHERE razao_social LIKE $2 || ' %'", [operacao, filtro])
      const { rows: [vendedor] } = await cliente.query(`INSERT INTO usuario(nome,email,papel,ativo)
        VALUES('Vendedor contextual fictício','vendedorcontextual@teste.local','vendedor',false) RETURNING id`)
      vendedorId = vendedor.id
      const { rows: [pedido] } = await cliente.query(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,estado)
        VALUES ($1,$2,$3,'','São Paulo','SP','concluido'), ($1,$2::date+1,'Pedido contextual excluído','','São Paulo','SP','planejado')
        RETURNING id,nicho`, [vendedorId, semana, nicho])
      coletaId = pedido.id
      const { rows: [confirmada] } = await cliente.query("INSERT INTO empresa(razao_social,telefone) VALUES($1,'11999993001') RETURNING id", [nomeEmpresa])
      await cliente.query(`INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao)
        SELECT $1,n,CASE WHEN n=51 THEN $2::uuid END,
          jsonb_build_object('nome_fantasia',CASE WHEN n=51 THEN $3 ELSE 'Candidata contextual ' || n END),
          CASE WHEN n=51 THEN 'entregue' ELSE 'pendente' END
        FROM generate_series(1,51) n`, [coletaId, confirmada.id, nomeEmpresa])
      await cliente.query('COMMIT')
    } catch (erro) {
      await cliente.query('ROLLBACK')
      throw erro
    }
  })
})

test('arquivo preserva duas paginações, volta à ficha e lista arquivada e recupera consulta vazia', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await entrarGestor(page)
  await page.goto(arquivo + '?' + new URLSearchParams({ q: filtro }))
  const listas = page.getByRole('region', { name: 'Listas arquivadas' })
  const empresas = page.getByRole('region', { name: 'Empresas cadastradas' })
  const paginarListas = listas.getByRole('navigation', { name: 'Paginação de listas arquivadas' })
  const paginarEmpresas = page.getByRole('navigation', { name: 'Paginação do arquivo' })
  await expect(listas.getByRole('link', { name: 'Ver lista' })).toHaveCount(50)
  await expect(paginarListas).toBeVisible()
  const proximaEmpresa = paginarEmpresas.getByRole('link', { name: 'Próxima' })
  await proximaEmpresa.focus()
  await page.keyboard.press('Enter')
  await conferirRecorte(page, arquivo, { q: filtro, pagina: '2' })
  await paginarListas.getByRole('link', { name: 'Próxima' }).click()
  const recorte = { q: filtro, pagina: '2', gruposPagina: '2' }
  await conferirRecorte(page, arquivo, recorte)
  await expect(listas.getByRole('heading', { name: 'Lista contextual 51' })).toBeVisible()
  await expect(empresas.getByRole('heading', { name: filtro + ' 51' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await empresas.getByRole('link', { name: 'Ficha administrativa' }).click()
  const voltarArquivo = page.getByRole('link', { name: 'Voltar ao arquivo', exact: true })
  await expect(voltarArquivo).toBeVisible()
  await expect(page.getByRole('heading', { name: filtro + ' 51' })).toBeVisible()
  await page.reload()
  await expect(voltarArquivo).toBeVisible()
  await voltarArquivo.click()
  await conferirRecorte(page, arquivo, recorte)

  await listas.getByRole('listitem').filter({ hasText: 'Lista contextual 51' }).getByRole('link', { name: 'Ver lista' }).click()
  await expect(page.getByRole('heading', { name: 'Lista contextual 51', level: 1 })).toBeVisible()
  const urlGrupo = page.url()
  await page.getByRole('link', { name: filtro + ' 51' }).click()
  await expect(page.getByRole('heading', { name: filtro + ' 51' })).toBeVisible()
  await page.reload()
  const voltarLista = page.getByRole('link', { name: 'Voltar para a lista', exact: true })
  await expect(voltarLista).toBeVisible()
  await voltarLista.click()
  await expect(page).toHaveURL(urlGrupo)
  const caminho = page.getByRole('navigation', { name: 'Localização atual' })
  await expect(caminho.getByRole('link', { name: 'Listas', exact: true })).toHaveCount(0)
  await caminho.getByRole('link', { name: 'Arquivo', exact: true }).click()
  await conferirRecorte(page, arquivo, recorte)

  await page.getByRole('textbox', { name: 'Nome ou CNPJ' }).fill('Busca sem retorno contextual')
  await page.getByRole('button', { name: 'Consultar arquivo' }).click()
  await conferirRecorte(page, arquivo, { q: 'Busca sem retorno contextual', gruposPagina: '2' })
  const limpar = page.getByRole('link', { name: 'Limpar busca do arquivo' })
  await expect(limpar).toHaveAttribute('href', arquivo + '?gruposPagina=2')
  await limpar.click()
  await conferirRecorte(page, arquivo, { q: null, pagina: null, gruposPagina: '2' })

  await page.goto(arquivo + '?' + new URLSearchParams({ ...recorte, pagina: '3' }))
  await expect(page.getByText('0 empresas arquivadas', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Voltar à primeira página', exact: true }).click()
  await conferirRecorte(page, arquivo, { q: filtro, pagina: null, gruposPagina: '2' })
  await expect(empresas.getByRole('link', { name: 'Ficha administrativa' })).toHaveCount(50)
})

test('Google conserva os filtros nos dois acessos, a página da coleta e a aba Histórico', async ({ page }) => {
  test.setTimeout(60_000)
  await entrarGestor(page)
  const filtros = { semana, vendedor: vendedorId, estado: 'concluido' }
  const planejamento = '/empresas/google'
  const coleta = planejamento + '/' + coletaId
  await page.goto(planejamento + '?' + new URLSearchParams(filtros))
  for (const rotulo of ['Ver pedido', 'Ver empresas e histórico']) {
    await expect(page.getByText('Pedido contextual excluído', { exact: true })).toHaveCount(0)
    const entrada = page.getByRole('link', { name: rotulo, exact: true })
    await expect(entrada).toHaveCount(1)
    await entrada.click()
    await expect(page.getByRole('link', { name: 'Voltar para planejamentos' })).toHaveAttribute('href', planejamento + '?' + new URLSearchParams(filtros))
    await page.getByRole('link', { name: 'Próxima página' }).click()
    await conferirRecorte(page, coleta, { pagina: '2' })
    await expect(page.getByRole('heading', { name: nomeEmpresa })).toBeVisible()
    await page.getByRole('link', { name: 'Ver ficha e histórico' }).click()
    await expect(page.getByRole('heading', { name: nomeEmpresa })).toBeVisible()
    const historico = page.getByRole('tab', { name: 'Histórico' })
    await historico.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('link', { name: 'Ver coleta' }).click()
    await page.getByRole('link', { name: 'Próxima página' }).click()
    await conferirRecorte(page, coleta, { pagina: '2' })
    await page.getByRole('link', { name: 'Ver ficha e histórico' }).click()
    await page.getByRole('link', { name: 'Voltar para a coleta' }).click()
    await conferirRecorte(page, coleta, { pagina: '2' })
    await page.reload()
    await page.getByRole('link', { name: 'Voltar ao histórico da empresa' }).click()
    await expect(historico).toHaveAttribute('aria-selected', 'true')
    await page.reload()
    await expect(historico).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('link', { name: 'Voltar para a coleta' }).click()
    await conferirRecorte(page, coleta, { pagina: '2' })
    await page.getByRole('link', { name: 'Voltar para planejamentos' }).click()
    await conferirRecorte(page, planejamento, filtros)
    await expect(entrada).toHaveCount(1)
  }
})
