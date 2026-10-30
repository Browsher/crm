import { expect, test, type Page } from '@playwright/test'
async function entrar(page:Page,usuario:string) {
 await page.goto('/login');await page.getByLabel('E-mail').fill(usuario+'@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL('/meu-dia')
}

test('consulta pessoal filtra e pagina sem expor contatos; bookmark antigo não abre catálogo',async({page},testInfo)=>{
 await entrar(page,'vendedore2e');await page.goto('/fila/localizar?legado=1&nome=Consulta%20E2E&cnae=4742300&uf=SP')
 await expect(page.getByRole('heading',{name:'Todas as minhas empresas',exact:true})).toBeVisible()
 const lista=page.getByRole('region',{name:'Todas as minhas empresas',exact:true}).getByRole('list')
 await expect(lista.getByRole('listitem')).toHaveCount(20)
 for(const privado of ['11987650001','contato-secreto@teste.local','Pessoa privada E2E'])expect(await page.content()).not.toContain(privado)
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:testInfo.outputPath('consulta-pessoal-mobile.png')})
 await page.getByRole('link',{name:'Próxima página',exact:true}).click()
 await expect(lista.getByRole('listitem')).toHaveCount(3)
 await page.goto('/fila/localizar?nome=Consulta%20E2E&uf=RJ')
 await expect(lista.getByRole('listitem')).toHaveCount(0)
 await page.goto('/fila/localizar?legado=1&uf=INVALIDO')
 await expect(page.getByRole('main').getByRole('alert')).toContainText('Um dos filtros é inválido')
})
test('visitante não acessa localização',async({page})=>{await page.goto('/fila/localizar?legado=1&nome=Consulta');await expect(page).toHaveURL('/login')})
