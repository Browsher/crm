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
        await cliente.query("SELECT set_config('app.usuario_id',$1,true)",[v.id])
        await cliente.query(`INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data)
          VALUES($1,'acompanhamento','Cliente pediu acompanhamento','Conversar sobre a proposta',(now() AT TIME ZONE 'America/Sao_Paulo')::date+$2::int)`,[e.id,i===0 ? -1 : 0])
      }
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
  const link = page.getByRole('link', { name:'Ver perfil de Carlos Almeida', exact:true })
  await expect(link).toHaveAttribute('href',`/usuarios/vendedores/${vendedorId}`)
  await link.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(`/usuarios/vendedores/${vendedorId}`)
  await expect(page.getByRole('heading', { name:'Carlos Almeida',exact:true })).toBeVisible()
  const resumo = page.getByRole('region', { name:'Resumo do vendedor' })
  await expect(resumo.locator('strong')).toHaveText(['2','1','1','2'])
  const carteira = page.getByRole('region', { name:'Empresas da carteira' })
  await expect(carteira.getByRole('row')).toHaveCount(3)
  await expect(carteira).toContainText('Alvorada Comércio')
  const historico = page.getByRole('region', { name:'Últimos atendimentos' })
  await expect(historico.getByRole('listitem')).toHaveCount(2)
  await expect(historico).toContainText('Cliente pediu acompanhamento')
  await expect(page.locator('main form')).toHaveCount(0)
  await expect(page.locator('main a[href^="/empresas/"]')).toHaveCount(0)
  for(const largura of [1280,390]) {
    await page.setViewportSize({ width:largura,height:900 })
    for(const tema of ['light','dark']) {
      await page.getByRole('combobox').selectOption(tema)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await page.screenshot({ path:`test-results/perfil-vendedor-${largura}-${tema}.png`,fullPage:true,animations:'disabled' })
    }
  }
  await page.getByRole('link', { name:'Voltar para Usuários' }).click()
  await expect(page).toHaveURL('/usuarios')
  await page.goto('/usuarios/vendedores/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('404',{ exact:true })).toBeVisible()
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
