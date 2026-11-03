import { expect, test } from '@playwright/test'
import { bancoGruposDoHarness } from './dados-grupos'

test('retorno combinado na Prospecção entra no Funil e Meu dia de hoje, sem virar cliente antes da venda',async({page})=>{
  const banco = bancoGruposDoHarness()
  const [{ data: hoje }] = await banco.sql<{ data: string }>(
    "SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY-MM-DD') AS data",
  )
  await page.goto('/login');await page.getByLabel('E-mail').fill('retornoe2e@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/fila/localizar?legado=1&cnae=7777799')
  await page.getByRole('button',{name:'Iniciar atendimento',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Retorno Combinado',exact:true}).first()).toBeVisible()
  await page.getByLabel('Falei, pediu para ligar em outro momento',{exact:true}).check()
  await page.getByLabel('Próximo passo',{exact:true}).fill('Ligar no horário combinado')
  await page.getByLabel('Data do próximo passo',{exact:true}).fill(hoje)
  await page.getByRole('button',{name:'Registrar',exact:true}).click()
  await expect(page).toHaveURL(url => url.pathname === '/funil' && url.searchParams.has('negociacao'))
  const [negociacao] = await banco.sql<{ id: string; empresa_id: string }>(
    `SELECT n.id,n.empresa_id FROM negociacao n JOIN empresa e ON e.id=n.empresa_id
     WHERE e.cnpj='00000000000901' AND n.encerrada_em IS NULL`,
  )
  await expect(page).toHaveURL('/funil?negociacao=' + negociacao.id)
  const modal = page.getByRole('dialog', { name: 'Retorno Combinado', exact: true })
  await expect(modal).toContainText('Ligar no horário combinado')
  await expect(modal.getByRole('textbox', { name: 'Nota', exact: true })).toHaveCount(0)
  expect(await banco.sql(`SELECT tipo,proximo_passo,proximo_passo_data::text
    FROM contato WHERE empresa_id=$1`, [negociacao.empresa_id]))
    .toEqual([{ tipo: 'retornar_depois', proximo_passo: 'Ligar no horário combinado', proximo_passo_data: hoje }])
  await page.goto('/meu-dia');await expect(page.getByRole('main')).toContainText('Retorno Combinado');await expect(page.getByRole('main')).toContainText('Ligar no horário combinado')
  await page.goto('/carteira');await expect(page.getByRole('main')).not.toContainText('Retorno Combinado')
})
