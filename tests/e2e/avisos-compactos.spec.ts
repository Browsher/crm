import { expect, test } from '@playwright/test'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'

const email = 'visuale2e@teste.local'
const descricao = 'Registre a primeira venda para incluir um cliente na carteira.'
const textoLongo = 'Orientação completa para encontrar a próxima empresa e continuar o atendimento. '.repeat(12) + 'ReferenciaSemEspacos'.repeat(20)

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL_ADMIN!
  exigirAdminLocal(url)
  const dados = await comAdmin(url, c => c.query(`SELECT u.id,
    (SELECT count(*)::int FROM venda v WHERE v.autor_id=u.id) vendas,
    (SELECT count(*)::int FROM empresa_vinculo ev JOIN venda v ON v.empresa_id=ev.empresa_id WHERE ev.vendedor_id=u.id) clientes
    FROM usuario u WHERE u.email=$1`, [email]))
  expect(dados.rows).toHaveLength(1)
  expect(dados.rows[0].vendas).toBe(0)
  expect(dados.rows[0].clientes).toBe(0)
})

for (const tema of ['light', 'dark']) {
  for (const width of [390, 820, 1280]) {
    test(`Carteira vazia ocupa faixa natural, preserva texto e ação: ${tema}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/login')
      await page.getByLabel('E-mail').fill(email)
      await page.getByLabel('Senha', { exact: true }).fill('Senha-e2e-2026')
      await page.getByRole('button', { name: 'Entrar', exact: true }).click()
      await expect(page).toHaveURL('/meu-dia')
      await page.goto('/carteira')
      await page.getByRole('combobox', { name: /Tema/ }).selectOption(tema)
      const titulo = page.getByRole('heading', { name: 'Sua carteira está vazia', level: 2, exact: true })
      const faixa = page.locator('[data-slot="card"]').filter({ has: titulo })
      const acao = faixa.getByRole('link', { name: 'Ir para Prospecção', exact: true })
      await expect(titulo).toBeVisible()
      await expect(faixa.getByText(descricao, { exact: true })).toBeVisible()
      await expect(acao).toHaveAttribute('href', '/fila')
      expect((await faixa.boundingBox())!.height).toBeLessThan(286)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({ path: `.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-1-captures/carteira-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })

      // Stress de layout no DOM real, sem alterar o conteúdo do produto ou criar rota de teste.
      const explicacao = faixa.locator('[data-slot="card-description"]')
      await explicacao.evaluate((el, texto) => { el.textContent = texto }, textoLongo)
      await expect(explicacao).toHaveText(textoLongo)
      const medidas = await explicacao.evaluate(el => ({
        largura: el.clientWidth, conteudo: el.scrollWidth,
        altura: el.clientHeight, alturaConteudo: el.scrollHeight,
        overflow: getComputedStyle(el).overflow, clamp: getComputedStyle(el).webkitLineClamp,
      }))
      expect(medidas.conteudo).toBeLessThanOrEqual(medidas.largura)
      expect(medidas.alturaConteudo).toBeLessThanOrEqual(medidas.altura)
      expect(medidas.overflow).not.toBe('hidden')
      expect(['none', ''].includes(medidas.clamp)).toBe(true)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await acao.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(acao).toBeFocused()
      expect(await acao.evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none')).toBe(true)
      await page.screenshot({ path: `.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-1-captures/texto-longo-${tema}-${width}.png`, fullPage: true, animations: 'disabled' })
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL('/fila')
    })
  }
}