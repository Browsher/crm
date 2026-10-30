import { expect, test, type Page } from '@playwright/test'
async function entrar(page:Page,usuario:string) {
 await page.goto('/login');await page.getByLabel('E-mail').fill(usuario+'@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL('/meu-dia')
}
const card=(page:Page,nome:string)=>page.locator('[data-slot=card]').filter({has:page.getByRole('heading',{name:nome,exact:true})})

test('visualização mantém vínculo sem iniciar e não revela empresa a outro usuário',async({page,browser})=>{
 await entrar(page,'recenteae2e');await page.goto('/fila/localizar')
 await card(page,'Recente própria').getByRole('button',{name:'Ver empresa: Recente própria'}).click()
 await expect(page.getByRole('dialog')).toContainText('(11) 99888-7777')
 await page.keyboard.press('Escape')
 await expect(card(page,'Recente própria').getByRole('button',{name:'Iniciar atendimento',exact:true})).toBeVisible()
 await page.reload();await expect(page.getByRole('heading',{name:'Recente própria',exact:true})).toBeVisible()
 const contexto=await browser.newContext()
 try{const outra=await contexto.newPage();await entrar(outra,'recentebe2e');await outra.goto('/fila/localizar?legado=1');await expect(outra.getByRole('heading',{name:'Recente própria',exact:true})).toHaveCount(0);expect(await outra.content()).not.toContain('11998887777')}
 finally{await contexto.close()}
})
