import { expect, test } from '@playwright/test'
import { Client } from 'pg'
import { FUNIL_EMPRESA } from './dados-funil'
test('Funil protege notas, conserva rascunho e registra primeira venda sem perder retorno',async({page})=>{
  await page.goto('/login');await page.getByLabel('E-mail').fill('funile2e@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL('/meu-dia')
  await page.goto('/funil')
  await expect(page.getByRole('heading',{name:'Funil comercial'})).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('Funil Privado')
  await expect(page.getByRole('main').locator('input')).toHaveCount(0)
  for(const tema of ['light','dark']){
    await page.getByRole('combobox',{name:'Tema do Funil'}).selectOption(tema)
    for(const width of [390,820,1280]){
      await page.setViewportSize({width,height:844})
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await page.screenshot({path:`test-results/funil-${tema}-${width}.png`,fullPage:true})
      await page.getByRole('button',{name:/Funil Aurora/}).click()
      const modal=page.getByRole('dialog');await expect(modal).toContainText('Nota própria Aurora');await expect(modal).not.toContainText('SEGREDO DO COLEGA');await expect(modal).not.toContainText('11977778888')
      await page.screenshot({path:`test-results/funil-modal-${tema}-${width}.png`})
      await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);await expect(page.getByRole('button',{name:/Funil Aurora/})).toBeFocused()
    }
  }
  await page.getByRole('button',{name:/Funil Aurora/}).click()
  await page.getByRole('combobox',{name:'Etapa',exact:true}).selectOption('proposta_enviada');await page.getByRole('button',{name:'Confirmar etapa'}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('region',{name:'Proposta enviada'})).toContainText('Funil Aurora')
  await page.getByRole('button',{name:/Funil Aurora/}).click();await page.getByRole('button',{name:'Registrar atendimento',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('11977778888');await page.getByRole('button',{name:'Voltar ao resumo'}).click()
  await page.getByRole('button',{name:'Registrar venda',exact:true}).click()
  await page.getByLabel('Valor em reais').fill('123,45')
  await page.keyboard.press('Escape');await expect(page.getByText('Descartar alterações?')).toBeVisible();await page.getByRole('button',{name:'Continuar editando',exact:true}).click();await expect(page.getByLabel('Valor em reais')).toHaveValue('123,45')
  await page.evaluate(()=>history.back());await expect(page.getByText('Descartar alterações?')).toBeVisible();await page.getByRole('button',{name:'Continuar editando',exact:true}).click()
  await page.getByLabel('Data da venda').fill('2026-01-01');await page.getByRole('button',{name:'Conferir venda'}).click();await page.getByRole('button',{name:'Confirmar venda',exact:true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:/Funil Aurora/})).toHaveCount(0)
  await page.goto('/carteira');await expect(page.getByRole('main')).toContainText('Funil Aurora')
  await page.goto('/meu-dia');await expect(page.getByRole('main')).toContainText('Funil Aurora')
  const c=new Client({connectionString:process.env.DATABASE_URL_ADMIN});await c.connect();try{expect((await c.query('SELECT count(*)::int AS n FROM venda WHERE empresa_id=$1',[FUNIL_EMPRESA])).rows[0].n).toBe(1)}finally{await c.end()}
})
