import { expect, test } from '@playwright/test'
import { Client } from 'pg'

test('retorno combinado na Prospecção entra no Funil e Meu dia de hoje, sem virar cliente antes da venda',async({page})=>{
  const c=new Client({connectionString:process.env.DATABASE_URL_ADMIN});await c.connect()
  let hoje:string
  try{hoje=(await c.query("SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM-DD') AS data")).rows[0].data}finally{await c.end()}
  await page.goto('/login');await page.getByLabel('E-mail').fill('retornoe2e@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/fila/localizar?legado=1&cnae=7777799')
  await page.getByRole('button',{name:'Iniciar atendimento',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Retorno Combinado',exact:true}).first()).toBeVisible()
  await page.getByLabel('Falei, pediu para ligar em outro momento',{exact:true}).check()
  await page.getByLabel('Próximo passo',{exact:true}).fill('Ligar no horário combinado')
  await page.getByLabel('Data do próximo passo',{exact:true}).fill(hoje)
  await page.getByRole('button',{name:'Registrar',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Atendimento registrado.'})).toBeVisible()
  await expect(page.getByRole('textbox',{name:'Nota',exact:true})).toHaveValue('')
  await page.goto('/funil');await expect(page.getByRole('heading',{name:'Retorno Combinado',exact:true}).first()).toBeVisible()
  await page.goto('/meu-dia');await expect(page.getByRole('main')).toContainText('Retorno Combinado');await expect(page.getByRole('main')).toContainText('Ligar no horário combinado')
  await page.goto('/carteira');await expect(page.getByRole('main')).not.toContainText('Retorno Combinado')
})
