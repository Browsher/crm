import { expect, test } from '@playwright/test'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

let vendedorId: string
test.beforeAll(async () => {
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('Execute pelo harness local de E2E')
  exigirAdminLocal(url)
  await comAdmin(url, async cliente => {
    await cliente.query('BEGIN')
    try {
      const { rows:[v] } = await cliente.query<{ id:string }>(`INSERT INTO usuario(nome,email,papel)
        VALUES('Carlos Almeida','perfilcarlos@teste.local','vendedor') RETURNING id`)
      vendedorId = v.id
      for (let i=0;i<2;i++) {
        const { rows:[e] } = await cliente.query<{ id:string }>(`INSERT INTO empresa(cnpj,razao_social,telefone)
          VALUES($1,$2,'11999999999') RETURNING id`,[`8080808000000${i}`,['Alvorada Comércio','Horizonte Serviços'][i]])
        await cliente.query('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)',[e.id,v.id])
        await cliente.query("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial,iniciada_em) VALUES($1,$2,'legado',now())",[e.id,v.id])
        await cliente.query("WITH g AS (INSERT INTO grupo_importacao(nome) VALUES('Origem perfil') RETURNING id) INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) SELECT id,$1 FROM g",[e.id])
        await cliente.query('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,100,gen_random_uuid())',[e.id,v.id])
        await cliente.query("SELECT set_config('app.usuario_id',$1,true)",[v.id])
        await cliente.query(`INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data)
          VALUES($1,'acompanhamento','Cliente pediu acompanhamento','Conversar sobre a proposta',(now() AT TIME ZONE 'America/Sao_Paulo')::date+$2::int)`,[e.id,i===0 ? -1 : 0])
        await cliente.query('UPDATE empresa_vinculo SET agenda_contato_id=(SELECT id FROM contato WHERE empresa_id=$1) WHERE empresa_id=$1',[e.id])
      }
      await cliente.query(`WITH empresas AS (
        INSERT INTO empresa(cnpj,razao_social,telefone)
        SELECT '8080808' || lpad(i::text,7,'0'), 'Prospect ' || lpad(i::text,2,'0'), '11999999999'
        FROM generate_series(2,50) i RETURNING id
      ), filas AS (
        INSERT INTO empresa_fila(empresa_id,vendedor_id) SELECT id,$1 FROM empresas RETURNING empresa_id
      )
      INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) SELECT empresa_id,$1,'legado' FROM filas`, [v.id])
      await cliente.query('COMMIT')
    } catch (erro) { await cliente.query('ROLLBACK'); throw erro }
  })
})

test('gestor abre perfil em Usuários, consulta carteira e histórico e volta à lista', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact:true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name:'Entrar', exact:true }).click()
  await expect(page).toHaveURL('/gestao')
  await expect(page.locator('main a[href*="/vendedores/"]')).toHaveCount(0)
  await page.getByRole('link', { name:'Usuários',exact:true }).click()
  await expect(page).toHaveURL('/usuarios')
  const recorte = 'busca=Carlos+Almeida&papel=vendedor&situacao=ativos'
  await page.goto(`/usuarios?${recorte}`)
  const link = page.getByRole('link', { name:'Ver perfil de Carlos Almeida', exact:true })
  const perfil = `/usuarios/vendedores/${vendedorId}?${recorte}`
  await expect(link).toHaveAttribute('href', perfil)
  await link.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(perfil)
  await expect(page.getByRole('heading', { name:'Carlos Almeida',exact:true })).toBeVisible()
  const resumo = page.getByRole('region', { name:'Resumo do vendedor' })
  await expect(resumo.locator('strong')).toHaveText(['2','1','1','2'])
  const consultas = page.getByRole('navigation', { name: 'Consultas do perfil' })
  const empresas = consultas.getByRole('button', { name: /^Empresas/ })
  const atendimentos = consultas.getByRole('button', { name: /^Atendimentos/ })
  const carteira = page.getByRole('dialog', { name: 'Empresas do vendedor', exact: true })
  const paginacao = carteira.getByRole('navigation', { name: 'Páginas das empresas' })
  const intervalo = paginacao.getByRole('status')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await empresas.focus()
  await page.keyboard.press('Enter')
  await expect(carteira.getByRole('heading', { name: 'Empresas do vendedor' })).toBeFocused()
  await expect(carteira.getByRole('article')).toHaveCount(50)
  await expect(carteira.locator('form, a[href^="/empresas/"]')).toHaveCount(0)
  const alvorada = carteira.getByRole('article', { name: 'Alvorada Comércio' })
  await expect(alvorada.getByText('CNPJ 80.808.080/0000-00')).toHaveCSS('user-select', 'text')
  await expect(alvorada.getByText('Conversar sobre a proposta')).toBeVisible()
  await expect(alvorada.locator('time')).toBeVisible()
  await expect(intervalo).toHaveText('1–50 de 51 empresas · Página 1 de 2')
  await expect(paginacao.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  await page.keyboard.press('Tab')
  await expect(carteira.getByRole('button', { name: 'Fechar' })).toBeFocused()
  await page.keyboard.press('Tab')
  const lista = carteira.getByRole('region', { name: 'Empresas desta página' })
  await expect(lista).toBeFocused()
  await expect(lista).toHaveCSS('outline-style', 'solid')
  const corpo = carteira.locator('[data-painel-corpo]')
  await page.keyboard.press('PageDown')
  await expect.poll(() => corpo.evaluate(elemento => elemento.scrollTop)).toBeGreaterThan(0)
  await paginacao.getByRole('link', { name: 'Próxima' }).click()
  await expect(page).toHaveURL(`${perfil}&pagina=2`)
  await expect(intervalo).toHaveText('51–51 de 51 empresas · Página 2 de 2')
  await expect(intervalo).toBeFocused()
  expect(await corpo.evaluate(elemento => elemento.scrollTop)).toBe(0)
  await expect(carteira.getByRole('article')).toHaveCount(1)
  await expect(carteira.getByRole('article', { name: 'Prospect 50' })).toBeVisible()
  await expect(paginacao.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  await carteira.getByRole('button', { name: 'Fechar' }).click()
  await expect(empresas).toBeFocused()

  await atendimentos.click()
  const painelAtendimentos = page.getByRole('dialog', { name: 'Últimos atendimentos' })
  const historico = painelAtendimentos.getByRole('region', { name: 'Histórico comercial' })
  await expect(painelAtendimentos.locator('form, a[href^="/empresas/"]')).toHaveCount(0)
  await expect(historico.getByRole('listitem')).toHaveCount(2)
  const vendas = historico.getByRole('button', { name: 'Vendas 0' })
  await vendas.click()
  await expect(historico.getByText('Nenhum registro neste filtro.')).toBeVisible()
  const filtroAtendimentos = historico.getByRole('button', { name: 'Atendimentos 2' })
  await filtroAtendimentos.click()
  const primeiroRegistro = historico.locator('details').first()
  await primeiroRegistro.locator('summary').press('Enter')
  await expect(primeiroRegistro.getByText('Cliente pediu acompanhamento')).toBeVisible()
  await expect(painelAtendimentos.locator('[data-painel-rodape]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(atendimentos).toBeFocused()

  await empresas.click()
  await expect(carteira.getByRole('article')).toHaveCount(1)
  await expect(intervalo).toHaveText('51–51 de 51 empresas · Página 2 de 2')
  await paginacao.getByRole('link', { name: 'Anterior' }).click()
  await expect(page).toHaveURL(`${perfil}&pagina=1`)
  await expect(carteira.getByRole('article')).toHaveCount(50)
  await carteira.getByRole('button', { name: 'Fechar' }).click()
  await atendimentos.click()
  await expect(filtroAtendimentos).toHaveAttribute('aria-pressed', 'true')
  await expect(primeiroRegistro.getByText('Cliente pediu acompanhamento')).toBeVisible()
  await painelAtendimentos.getByRole('button', { name: 'Fechar' }).click()

  await expect(page.locator('main form, main a[href^="/empresas/"]')).toHaveCount(0)
  for(const largura of [1280,390]) {
    await page.setViewportSize({ width:largura,height:900 })
    for(const tema of ['light','dark']) {
      await page.getByLabel('Tema de Usuários').selectOption(tema)
      await empresas.click()
      await expect(page.locator('.ui-dialog-portal')).toHaveAttribute('data-theme', tema)
      const caixa = (await carteira.boundingBox())!
      expect(caixa.width).toBe(largura === 390 ? 390 : 520)
      expect(caixa.x + caixa.width).toBe(largura)
      expect(caixa.y).toBe(0)
      expect(caixa.height).toBe(900)
      await expect(carteira.getByText('Carlos Almeida', { exact: true })).toHaveCSS('overflow-wrap', 'anywhere')
      const rodape = (await paginacao.boundingBox())!
      expect(rodape.y + rodape.height).toBeLessThanOrEqual(900)
      const botao = (await paginacao.getByRole('link', { name: 'Próxima' }).boundingBox())!
      expect(botao.height).toBeGreaterThanOrEqual(largura === 390 ? 44 : 40)
      expect(await corpo.evaluate(elemento => elemento.scrollWidth <= elemento.clientWidth)).toBe(true)
      await page.screenshot({ path:`test-results/perfil-vendedor-${largura}-${tema}.png`,animations:'disabled' })
      await carteira.getByRole('button', { name: 'Fechar' }).click()
    }
  }
  await page.getByRole('link', { name:'Voltar para Usuários' }).click()
  await expect(page).toHaveURL(`/usuarios?${recorte}`)
  await expect(page.getByLabel('Buscar usuário')).toHaveValue('Carlos Almeida')
  await page.goto('/usuarios/vendedores/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('404',{ exact:true })).toBeVisible()
})

test('URL direta conserva a página de empresas e permite recuperar um recorte fora do intervalo', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/gestao')
  const recorte = 'busca=Carlos+Almeida&papel=vendedor&situacao=ativos'
  const perfil = `/usuarios/vendedores/${vendedorId}?${recorte}&paginaLista=2`
  const empresas = page.getByRole('navigation', { name: 'Consultas do perfil' }).getByRole('button', { name: /^Empresas/ })
  const carteira = page.getByRole('dialog', { name: 'Empresas do vendedor' })
  await page.goto(`${perfil}&pagina=2`)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await empresas.click()
  await expect(carteira.getByRole('article', { name: 'Prospect 50' })).toBeVisible()
  await page.goto(`${perfil}&pagina=3`)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await empresas.click()
  await expect(carteira.getByText('Nenhuma empresa nesta página')).toBeVisible()
  await carteira.getByRole('link', { name: 'Voltar para a primeira página' }).click()
  await expect(page).toHaveURL(`${perfil}&pagina=1`)
  await expect(carteira.getByRole('article')).toHaveCount(50)
  await carteira.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByRole('link', { name: 'Voltar para Usuários' })).toHaveAttribute('href', `/usuarios?${recorte}&pagina=2`)
})

test('vendedor não acessa o perfil administrativo de outro vendedor', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('vendedore2e@teste.local')
  await page.getByLabel('Senha',{ exact:true }).fill('Senha-e2e-2026')
  await page.getByRole('button',{ name:'Entrar',exact:true }).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto(`/usuarios/vendedores/${vendedorId}`)
  await expect(page).toHaveURL('/meu-dia')
  await expect(page.getByRole('heading',{ name:'Carlos Almeida',exact:true })).toHaveCount(0)
})
