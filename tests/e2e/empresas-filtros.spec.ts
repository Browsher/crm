import { expect, test, type Locator } from '@playwright/test'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

const NOME_LONGO = 'Filtros E2E Empresa 01 Comércio de equipamentos e soluções para iluminação e segurança com razão social extensa de teste'

async function medirContraste(controle: Locator) {
  return controle.evaluate(elemento => {
    type Cor = [number, number, number, number]
    const lerCor = (valor: string): Cor => {
      const canais = valor.match(/[\d.]+/g)!.map(Number)
      return [canais[0], canais[1], canais[2], canais[3] ?? 1]
    }
    const sobrepor = (frente: Cor, fundo: Cor): Cor => {
      const alfa = frente[3] + fundo[3] * (1 - frente[3])
      if (alfa === 0) return [0, 0, 0, 0]
      const canal = (indice: number) => (frente[indice] * frente[3] + fundo[indice] * fundo[3] * (1 - frente[3])) / alfa
      return [canal(0), canal(1), canal(2), alfa]
    }
    const estilo = getComputedStyle(elemento)
    let fundo = lerCor(estilo.backgroundColor)
    let opacidadeEfetiva = Number(estilo.opacity)
    let ancestral = elemento.parentElement
    const fundosAncestrais: string[] = []
    while (ancestral) {
      const estiloAncestral = getComputedStyle(ancestral)
      opacidadeEfetiva *= Number(estiloAncestral.opacity)
      if (fundo[3] < 1) {
        fundosAncestrais.push(estiloAncestral.backgroundColor)
        fundo = sobrepor(fundo, lerCor(estiloAncestral.backgroundColor))
      }
      ancestral = ancestral.parentElement
    }
    fundo = sobrepor(fundo, [255, 255, 255, 1])
    const texto = sobrepor(lerCor(estilo.color), fundo)
    const luminancia = (cor: Cor) => {
      const canais = cor.slice(0, 3).map(valor => {
        const canal = valor / 255
        return canal <= .04045 ? canal / 12.92 : ((canal + .055) / 1.055) ** 2.4
      })
      return canais[0] * .2126 + canais[1] * .7152 + canais[2] * .0722
    }
    const luminancias = [luminancia(texto), luminancia(fundo)].sort((a, b) => b - a)
    return {
      color: estilo.color, backgroundColor: estilo.backgroundColor, opacity: estilo.opacity,
      opacidadeEfetiva, fundosAncestrais, fundoEfetivo: fundo.slice(0, 3),
      contraste: (luminancias[0] + .05) / (luminancias[1] + .05),
    }
  })
}

test('Empresas conserva filtros e reflow com dados longos', async ({ page, browser }) => {
  test.setTimeout(60_000)
  const url = process.env.DATABASE_URL_ADMIN
  if (!url) throw new Error('Use o harness E2E')
  exigirAdminLocal(url)
  if (!/^\/teste_[0-9a-f]{12}$/.test(new URL(url).pathname)) throw new Error('Banco temporário obrigatório')
  await comAdmin(url, async cliente => {
    await cliente.query(`INSERT INTO cep (cep, bairro, localidade, uf, ibge) VALUES
      ('30110000','Savassi','Belo Horizonte de teste','MG','3106200'),
      ('30110001','Centro mineiro','Belo Horizonte de teste','MG','3106200'),
      ('90010000','Centro gaúcho','Porto Alegre de teste','RS','4314902')`)
    await cliente.query(`INSERT INTO empresa (cnpj,razao_social,telefone,cep,cnae_principal)
      SELECT '9000000000' || lpad(n::text,4,'0'), CASE WHEN n=1 THEN $1 ELSE 'Filtros E2E Empresa ' || lpad(n::text,2,'0') END,
        '11987654321','30110000','4742300' FROM generate_series(1,51) n`, [NOME_LONGO])
    await cliente.query(`INSERT INTO empresa (cnpj,razao_social,telefone,cep,cnae_principal) VALUES
      ('90000000000052','Filtros E2E Outro bairro','11987654321','30110001','4742300'),
      ('90000000000053','Filtros E2E Sem CNAE','11987654321','30110000',NULL),
      ('90000000000054','Filtros E2E Porto Alegre','11987654321','90010000',NULL)`)
  })
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('gestore2e@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/gestao')
  await page.goto('/empresas?q=Filtros+E2E')
  const estado = page.getByLabel('Estado', { exact: true })
  const cidade = page.getByLabel('Cidade', { exact: true })
  const bairro = page.getByLabel('Bairro', { exact: true })
  const cnae = page.getByLabel('CNAE', { exact: true })
  await expect(cidade).toBeDisabled()
  await expect(bairro).toBeDisabled()
  await estado.selectOption('MG')
  await expect(page).toHaveURL(/uf=MG/)
  await cidade.selectOption('3106200')
  await expect(page).toHaveURL(/cidade=3106200/)
  await bairro.selectOption('Savassi')
  await cnae.selectOption('4742300')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByText('51 empresas', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Buscar empresas', { exact: true })).toBeVisible()
  await expect(page.locator('main form form')).toHaveCount(0)
  await expect(page.getByRole('main').locator('form [data-slot=card]')).toHaveCount(1)
  const tabela = page.getByRole('region', { name: 'Empresas cadastradas', exact: true })
  await expect(tabela.getByRole('listitem')).toHaveCount(50)
  await expect(tabela).not.toContainText('Outro bairro')
  await expect(tabela).not.toContainText('Sem CNAE')
  await expect(tabela).not.toContainText('Porto Alegre')
  for (const tema of ['light', 'dark']) {
    await page.getByLabel('Tema de Empresas').selectOption(tema)
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      const empresaLonga = tabela.getByRole('listitem').filter({ has: page.getByRole('heading', { name: NOME_LONGO, exact: true }) }).getByRole('link', { name: 'Ficha administrativa', exact: true })
      await empresaLonga.scrollIntoViewIfNeeded()
      await expect(empresaLonga).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/empresa-linha-longa-${tema}-${width}.png` })
    }
  }
  // A ficha conserva filtros aplicados e pode não ter sócios enriquecidos.
  await tabela.getByRole('listitem').filter({ has: page.getByRole('heading', { name: NOME_LONGO, exact: true }) }).getByRole('link', { name: 'Ficha administrativa', exact: true }).click()
  await expect(page.getByRole('heading', { name: NOME_LONGO, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dados dos sócios e representantes', exact: true })).toHaveCount(0)
  for (const tema of ['light', 'dark']) {
    await page.getByLabel('Tema de Empresas').selectOption(tema)
    for (const width of [390, 820, 1100, 1200, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.getByRole('heading', { name: NOME_LONGO, exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/empresa-perfil-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })
      if (tema === 'dark' && width === 390) {
        // A captura conclui as transições finitas antes de medir o estado estável.
        const medidas = []
        for (const [nome, controle] of [
          ['Tema de Empresas', page.getByLabel('Tema de Empresas')],
          ['Voltar para empresas', page.getByRole('link', { name: 'Voltar para empresas', exact: true })],
        ] as const) {
          await expect(controle).toBeEnabled()
          const medida = await medirContraste(controle)
          medidas.push({ nome, ...medida })
          expect(medida.opacity).toBe('1')
          expect(medida.opacidadeEfetiva).toBe(1)
          expect(medida.contraste).toBeGreaterThanOrEqual(4.5)
        }
        console.log('Contraste da ficha dark/390 estabilizada:', JSON.stringify(medidas))
      }
    }
  }
  await page.getByRole('link', { name: 'Voltar para empresas', exact: true }).click()
  await expect(page).toHaveURL('/empresas?q=Filtros+E2E&cnae=4742300&uf=MG&cidade=3106200&bairro=Savassi&pagina=1')
  await expect(estado).toHaveValue('MG')
  await expect(cidade).toHaveValue('3106200')
  await expect(bairro).toHaveValue('Savassi')
  // Edição ainda não enviada não pode parecer filtro aplicado após paginar.
  await page.getByLabel('Buscar empresas', { exact: true }).fill('Rascunho não enviado')
  await cnae.selectOption('nao_informado')
  await bairro.selectOption('Centro mineiro')
  await page.getByRole('link', { name: 'Próxima', exact: true }).click()
  await expect(tabela.getByRole('listitem')).toHaveCount(1)
  await expect(tabela).toContainText('Filtros E2E Empresa 51')
  const params = new URL(page.url()).searchParams
  expect(Object.fromEntries(params)).toEqual({ q: 'Filtros E2E', cnae: '4742300', uf: 'MG', cidade: '3106200', bairro: 'Savassi', pagina: '2' })
  await expect(page.getByLabel('Buscar empresas', { exact: true })).toHaveValue('Filtros E2E')
  await expect(cnae).toHaveValue('4742300')
  await expect(bairro).toHaveValue('Savassi')

  for (const tema of ['light', 'dark']) {
    await page.getByLabel('Tema de Empresas').selectOption(tema)
    for (const width of [390, 820, 1100, 1200, 1280, 1920]) {
      await page.setViewportSize({ width, height: 844 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const painel = page.getByRole('main').locator('form [data-slot=card]')
      await expect(painel).toHaveCSS('border-radius', '10px')
      await expect(painel).toHaveCSS('padding-top', width <= 820 ? '20px' : '24px')
      await expect(page.getByRole('main')).toHaveCSS('padding-left', width <= 820 ? '16px' : '32px')
      await expect(page.getByLabel('Buscar empresas', { exact: true })).toHaveCSS('font-size', width <= 820 ? '16px' : '14px')
      await expect(page.getByLabel('Buscar empresas', { exact: true })).toHaveCSS('min-height', width <= 820 ? '44px' : '40px')
      const sobreposicoes = await painel.evaluate(elemento => {
        const controles = [...elemento.querySelectorAll('input,select,button,a')].map(campo => campo.getBoundingClientRect()).filter(r => r.width && r.height)
        return controles.flatMap((a, indice) => controles.slice(indice + 1).filter(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1)).length
      })
      expect(sobreposicoes).toBe(0)
      expect((await tabela.getByRole('link').first().boundingBox())!.height).toBeGreaterThanOrEqual(width <= 820 ? 44 : 40)
      expect((await page.getByRole('link', { name: 'Anterior', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(width <= 820 ? 44 : 40)
      await expect(tabela.locator('[data-slot=card]').first()).toHaveCSS('padding-top', width <= 820 ? '20px' : '24px')
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/empresas-filtros-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })
    }
  }

  await estado.selectOption('RS')
  await expect(page).toHaveURL(/uf=RS/)
  await expect(cidade).toHaveValue('')
  await expect(bairro).toBeDisabled()
  expect(new URL(page.url()).searchParams.has('pagina')).toBe(false)
  expect(new URL(page.url()).searchParams.has('bairro')).toBe(false)
  await cidade.selectOption('4314902')
  await expect(page).toHaveURL(/cidade=4314902/)
  await cnae.selectOption('nao_informado')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByText('1 empresa', { exact: true })).toBeVisible()
  await expect(tabela).toContainText('Filtros E2E Porto Alegre')
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).click()
  await expect(page).toHaveURL('/empresas')
  await expect(page.getByLabel('Buscar empresas', { exact: true })).toHaveValue('')
  await expect(estado).toHaveValue('')
  await expect(cnae).toHaveValue('')
  await expect(cidade).toBeDisabled()
  await expect(bairro).toBeDisabled()
  await page.getByLabel('Buscar empresas', { exact: true }).fill('Outro rascunho')
  await cnae.selectOption('4742300')
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).click()
  await expect(page).toHaveURL('/empresas')
  await expect(page.getByLabel('Buscar empresas', { exact: true })).toHaveValue('')
  await expect(cnae).toHaveValue('')
  const contextoToque = await browser.newContext({
    baseURL: 'http://localhost:3100', hasTouch: true, viewport: { width: 1280, height: 900 },
    storageState: await page.context().storageState(),
  })
  try {
    const toque = await contextoToque.newPage()
    await toque.goto('/empresas?q=Filtros+E2E')
    for (const tema of ['light', 'dark']) {
      await toque.getByLabel('Tema de Empresas').selectOption(tema)
      await expect(toque.getByLabel('Buscar empresas', { exact: true })).toHaveCSS('font-size', '16px')
      await expect(toque.getByLabel('Buscar empresas', { exact: true })).toHaveCSS('min-height', '44px')
      expect((await toque.getByRole('region', { name: 'Empresas cadastradas', exact: true }).getByRole('link').first().boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await toque.screenshot({ path: `.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-7-captures/empresas-toque-${tema}-1280.png` })
    }
  } finally { await contextoToque.close() }
})
