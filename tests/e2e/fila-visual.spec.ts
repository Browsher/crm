import { expect, test, type Page } from '@playwright/test'
async function entrar(page:Page,usuario:string) {
 await page.goto('/login');await page.getByLabel('E-mail').fill(usuario+'@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL('/meu-dia')
}
const card=(page:Page,nome:string)=>page.locator('[data-slot=card]').filter({has:page.getByRole('heading',{name:nome,exact:true})})

test('atendimento direto mantém rascunho e reflow nos dois temas',async({page})=>{
 await entrar(page,'visuale2e');await page.goto('/fila/localizar?cnae=8888888')
 await card(page,'Visual E2E A').getByRole('button',{name:'Iniciar atendimento',exact:true}).click()
 await expect(page).toHaveURL(/\/fila\/atendimento\//)
 const atendimento=page.url()
 await page.getByLabel('Nota',{exact:true}).fill('Rascunho da interface nova')
 for(const tema of ['light','dark']) {
  await page.getByRole('combobox',{name:/Tema/}).selectOption(tema)
  for(const width of [390,820,1000,1280]) {
   await page.setViewportSize({width,height:844})
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   await expect(page.getByLabel('Nota',{exact:true})).toHaveValue('Rascunho da interface nova')
  }
 }
 await page.screenshot({path:'test-results/atendimento-visual-mobile.png',fullPage:true})
 await page.goto('/fila/localizar?cnae=8888888')
 await card(page,'Visual E2E B').getByRole('button',{name:'Iniciar atendimento',exact:true}).click()
 await expect(page.getByLabel('Nota',{exact:true})).toHaveValue('')
 await page.goto(atendimento);await expect(page.getByLabel('Nota',{exact:true})).toHaveValue('Rascunho da interface nova')
})
