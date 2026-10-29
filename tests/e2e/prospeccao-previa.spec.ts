import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
const capturas = resolve('.superpowers/sdd/2026-10-27-padronizacao-elementos-crm/task-5-captures')
mkdirSync(capturas, { recursive: true })
import { expect, test, type Page } from '@playwright/test'
import { comBancoGrupos } from './dados-grupos'
async function entrar(page:Page) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('redesigne2e@teste.local')
  await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026')
  await page.getByRole('button',{name:'Entrar',exact:true}).click()
  await expect(page).toHaveURL('/meu-dia')
}
test('central abre consulta pessoal e nicho restringe bairros; Enter recolhe os filtros',async({page})=>{
  await entrar(page)
  await page.goto('/fila')
  await expect(page.getByRole('heading',{name:'Prospecção',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'Planejar buscas',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'Buscar novas empresas',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Localizar empresas',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Todas as minhas empresas',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Armarinhos Horizonte (fictícia)',exact:true})).toBeVisible()
  await page.getByLabel('Nicho',{exact:true}).selectOption('Armarinhos')
  await expect(page).toHaveURL(/nicho=Armarinhos/)
  const endereco=page.getByLabel('Endereço',{exact:true})
  await expect(endereco.locator('option')).toHaveText(['Todos os bairros disponíveis','Centro · São Paulo/SP'])
  await endereco.selectOption('Centro · São Paulo/SP')
  await page.getByRole('button',{name:'Mais filtros',exact:true}).click()
  await page.getByLabel('Nome da empresa',{exact:true}).press('Enter')
  await expect(page.getByRole('button',{name:'Editar filtros',exact:true})).toBeVisible()
  await expect(page.getByLabel('Nicho',{exact:true})).not.toBeVisible()
  await page.getByRole('button',{name:'Editar filtros',exact:true}).click()
  await page.getByRole('button',{name:'Mais filtros',exact:true}).click()
  await expect(page.getByLabel('CNPJ',{exact:true})).toBeVisible()
  await expect(page.getByLabel('Situação cadastral',{exact:true})).toHaveCount(0)
  await expect(page.getByLabel('CEP informado',{exact:true})).toHaveCount(0)
})
test('banco tem seis cartões, paginação e sugestão do nome conectadas à Casa simulada',async({page})=>{
  await entrar(page)
  await page.goto('/fila/buscar?fonte=banco')
  await expect(page.getByRole('button',{name:'Atividade e nome',exact:true})).toHaveAttribute('aria-expanded','true')
  const local=page.getByRole('button',{name:'Localização',exact:true})
  await expect(local).toHaveAttribute('aria-expanded','false')
  await page.getByLabel('Nome ou palavra-chave',{exact:true}).fill('iluminação')
  await page.getByLabel('CNAEs principais',{exact:true}).fill('4742300')
  await local.click()
  await page.getByLabel('Estado',{exact:true}).selectOption('SP')
  await page.getByLabel('Cidade',{exact:true}).fill('São Paulo')
  await page.getByLabel('Bairros',{exact:true}).fill('Centro')
  await page.getByRole('button',{name:'Resultados e dados retornados',exact:true}).click()
  await page.getByRole('button',{name:'Sugerir nome',exact:true}).click()
  await expect(page.getByLabel('Nome da lista',{exact:true})).toHaveValue('iluminação · Centro · São Paulo/SP')
  await page.getByLabel('Quantidade de empresas',{exact:true}).fill('2')
  await expect(page.getByRole('button',{name:'Contar resultados',exact:true})).toHaveCount(0)
  await expect(page.getByLabel('Página de resultados',{exact:true})).toHaveValue('1')
  await page.getByRole('button',{name:'Buscar empresas',exact:true}).click()
  await expect(page).toHaveURL(/busca=[0-9a-f-]{36}/)
  await expect(page.getByRole('heading',{name:'Luminárias Horizonte fictícia',exact:true})).toBeVisible()
})
test('perfil e reserva vigente preservam a consulta pessoal até a próxima aquisição',async({page})=>{
  await entrar(page)
  const consulta='/fila/localizar?origem=google&nicho=Lojas+de+brinquedos'
  const empresa=()=>page.getByRole('article').filter({has:page.getByRole('heading',{name:'Mundo de Papel (fictícia)',exact:true})})
  await page.goto(consulta)
  await empresa().getByRole('link',{name:'Ver empresa',exact:true}).click()
  await expect(page).toHaveURL(/pessoal=/)
  await expect(page.getByRole('region',{name:'Pesquisa atual',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'Alterar filtros',exact:true})).toHaveAttribute('href',/pessoal=/)
  await expect(page.getByRole('link',{name:'Escolher outra lista',exact:true})).toHaveCount(0)
  await page.getByRole('link',{name:'Voltar para localizar',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Todas as minhas empresas',exact:true})).toBeVisible()
  const contexto=JSON.parse(new URL(page.url()).searchParams.get('pessoal')!)
  expect(contexto).toMatchObject({origem:'google',nicho:'Lojas de brinquedos'})
  await empresa().getByRole('button',{name:'Reservar para ligar',exact:true}).click()
  await expect(page).toHaveURL(/\/fila\?/)
  await expect(page.getByRole('heading',{name:'Mundo de Papel (fictícia)',exact:true})).toBeVisible()
  await page.goto(consulta)
  await empresa().getByRole('link',{name:'Continuar atendimento',exact:true}).click()
  await expect(page).toHaveURL(/pessoal=/)
  await page.getByRole('button',{name:'Próxima',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Brinquedos do Bairro (fictícia)',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Registrar resultado',exact:true}).click()
  await page.getByLabel('Nota',{exact:true}).fill('Regressão fictícia da navegação pessoal')
  await page.getByRole('button',{name:'Registrar',exact:true}).click()
  await expect(page.getByLabel('Nota',{exact:true})).toHaveCount(0)
})

test('as quatro telas seguem a prévia em desktop e celular, nos dois temas',async({page})=>{
  test.setTimeout(120000)
  await page.emulateMedia({reducedMotion:'reduce'})
  await entrar(page)
  for(const [tela,url] of [['central','/fila'],['localizar','/fila/localizar'],['banco','/fila/buscar?fonte=banco'],['google','/fila/google']]) {
    await page.goto(url)
    for(const largura of [1920,820,390]) {
      await page.setViewportSize({width:largura,height:largura===1920?1080:844})
      for(const tema of ['light','dark']) {
        await page.getByRole('combobox',{name:/Tema/}).selectOption(tema)
        await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0)
        if(tela==='central'||tela==='banco') {
          const cartao=tela==='central'?page.getByRole('heading',{name:'Localizar empresas',exact:true}).locator('..').locator('..').locator('..'):page.getByRole('button',{name:'Atividade e nome',exact:true}).locator('..').locator('..')
          const css=await cartao.evaluate(el=>{const c=getComputedStyle(el);return {raio:c.borderRadius,borda:c.borderTopWidth,sombra:c.boxShadow}})
          expect(css).toEqual({raio:'10px',borda:'1px',sombra:'none'})
        }

        if(tela==='localizar'&&largura===1920) {
          const grade=page.getByRole('list').filter({has:page.getByRole('heading',{name:'Mundo de Papel (fictícia)',exact:true})})
          await expect.poll(()=>grade.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3)
        }
        await page.screenshot({path:resolve(capturas, `${tela}-${largura}-${tema}.png`),fullPage:true})
      }
    }
  }
  // A localização por lista usa o formulário completo, distinto da pesquisa pessoal.
  await page.goto('/fila/localizar?legado=1&nome=Fictícia&uf=SP&cidade=3550308')
  await expect(page.getByRole('heading',{name:'Localizar empresa',exact:true})).toBeVisible()
  const formulario=page.locator('form').filter({has:page.getByRole('button',{name:'Consultar',exact:true})})
  const consultar=formulario.getByRole('button',{name:'Consultar',exact:true})
  const limpar=formulario.getByRole('link',{name:'Limpar filtros',exact:true})
  const nomes=['nome','cnae','uf','cidade','bairro']
  const valores=await formulario.evaluate(el=>[...new FormData(el as HTMLFormElement).entries()])
  for(const largura of [1200,1101,1100]) {
    await page.setViewportSize({width:largura,height:900})
    for(const tema of ['light','dark']) {
      await page.getByRole('combobox',{name:/Tema/}).selectOption(tema)
      await page.screenshot({path:resolve(capturas,`localizar-legado-reflow-${largura}-${tema}.png`),fullPage:true})
      const geometria=await formulario.evaluate(el=>{
        const campos=Array.from(el.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input:not([type=hidden]),select')).map(c=>c.getBoundingClientRect())
        const acoes=Array.from(el.querySelectorAll('button,a')).map(c=>c.getBoundingClientRect())
        const elementoGrade=el.querySelector('input[name=nome]')!.parentElement!.parentElement!
        const grade=elementoGrade.getBoundingClientRect()
        return {
          colunas:getComputedStyle(elementoGrade).gridTemplateColumns.split(' ').length,
          camposContidos:campos.every(c=>c.left>=grade.left-1&&c.right<=grade.right+1),
          camposAlcancaveis:campos.every(c=>c.width>0&&c.left>=0&&c.right<=innerWidth),
          acoesAbaixo:Math.min(...acoes.map(c=>c.top))>=Math.max(...campos.map(c=>c.bottom)),
          semColisao:campos.every(c=>acoes.every(a=>c.right<=a.left||c.left>=a.right||c.bottom<=a.top||c.top>=a.bottom)),
          overflow:document.documentElement.scrollWidth-innerWidth,
        }
      })
      expect(geometria,`Reflow legado em ${largura}px/${tema}`).toEqual({colunas:largura>1100?5:2,camposContidos:true,camposAlcancaveis:true,acoesAbaixo:true,semColisao:true,overflow:0})
      await formulario.locator('[name=nome]').focus()
      for(let i=0;i<nomes.length;i++) {
        await expect(formulario.locator(`[name=${nomes[i]}]`)).toBeFocused()
        await page.keyboard.press('Tab')
      }
      await expect(consultar).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(limpar).toBeFocused()
      await expect(consultar).toBeInViewport()
      await expect(limpar).toBeInViewport()
      expect(await formulario.evaluate(el=>[...new FormData(el as HTMLFormElement).entries()])).toEqual(valores)
    }
  }

})


test('novos filtros Casa conservam CNAEs separados, últimos dias e exclusões no histórico',async({page,browser})=>{
 test.setTimeout(60000)
 await entrar(page);await page.goto('/fila/buscar?fonte=banco')
 await page.getByLabel('CNAEs principais',{exact:true}).fill('4755502')
 await page.getByLabel('CNAEs secundários',{exact:true}).fill('4742300')
 await page.getByRole('button',{name:'Capital e data de abertura',exact:true}).click()
 await page.getByLabel('Abertura a partir de',{exact:true}).fill('2020-01-01')
 await page.getByLabel('Filtrar abertura por',{exact:true}).selectOption('ultimosDias')
 await page.getByLabel('Abertas nos últimos dias',{exact:true}).fill('7')
 await page.getByRole('button',{name:'Perfil da empresa',exact:true}).click()
 await page.getByRole('checkbox',{name:'MEI',exact:true}).check()
 await expect(page.getByLabel('Excluir optantes do MEI',{exact:true})).toBeDisabled()
 await page.getByRole('checkbox',{name:'MEI',exact:true}).uncheck()
 await page.getByLabel('Excluir optantes do MEI',{exact:true}).check()
 await expect(page.getByRole('checkbox',{name:'MEI',exact:true})).toBeDisabled()
 await page.getByLabel('Exclusão do MEI a partir de',{exact:true}).fill('2025-01-01')
 await page.getByLabel('Excluir optantes do Simples Nacional',{exact:true}).check()
 await expect(page.getByRole('checkbox',{name:'Optante pelo Simples Nacional',exact:true})).toBeDisabled()
 await page.getByLabel('Exclusão do Simples até',{exact:true}).fill('2026-01-01')
 await page.getByRole('button',{name:'Resultados e dados retornados',exact:true}).click()
 await page.getByLabel('Nome da lista',{exact:true}).fill('Novos filtros Casa fictícios')
 await page.getByLabel('Quantidade de empresas',{exact:true}).fill('1')
 await page.getByRole('button',{name:'Buscar empresas',exact:true}).click()
 await expect(page).toHaveURL(/busca=[0-9a-f-]{36}/)
 const id=new URL(page.url()).searchParams.get('busca')!
 const [b]=await comBancoGrupos(async c=>(await c.query("SELECT filtros->'avancados' f FROM busca_empresa WHERE id=$1",[id])).rows)
 expect(b.f).toMatchObject({cnaes:['4755502'],cnaesSecundarios:['4742300'],aberturaDe:'',aberturaAte:'',aberturaUltimosDias:'7',excluirMei:true,meiExclusaoDe:'2025-01-01',excluirSimples:true,simplesExclusaoAte:'2026-01-01'})
 const estatisticas=await (await fetch(process.env.CNPJ_BIZ_MOCK_URL+'/estatisticas')).json()
 expect(estatisticas.ultimaCasa).toMatchObject({incluir_atividade_secundaria:false,codigo_atividade_principal:['4755502'],codigo_atividade_secundaria:['4742300'],data_abertura:{ultimos_dias:7},mei:{excluir_optante:true,data_exclusao:{inicio:'2025-01-01'}},simples:{excluir_optante:true,data_exclusao:{fim:'2026-01-01'}}})
 const contexto=await browser.newContext()
 try{
  const g=await contexto.newPage();await g.goto('/login');await g.getByLabel('E-mail').fill('gestore2e@teste.local');await g.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await g.getByRole('button',{name:'Entrar',exact:true}).click();await expect(g).toHaveURL('/gestao')
  await g.goto('/empresas/busca?busca='+id)
  await expect(g.getByText('CNAEs secundários',{exact:true})).toBeVisible()
  await expect(g.getByText('Abertas nos últimos dias',{exact:true})).toBeVisible()
  await expect(g.getByText('Excluir optantes do MEI',{exact:true})).toBeVisible()
  await expect(g.getByText('Exclusão do Simples até',{exact:true})).toBeVisible()
 }finally{await contexto.close()}
})


for(const dias of ['0','1.5']) test('últimos dias inválido '+dias+' em cartão recolhido informa erro e não faz consulta',async({page})=>{
 await entrar(page);await page.goto('/fila/buscar?fonte=banco')
 await page.getByRole('button',{name:'Capital e data de abertura',exact:true}).click()
 await page.getByLabel(/Filtrar abertura por/).selectOption('ultimosDias')
 await page.getByLabel(/Abertas nos últimos dias/).fill(dias)
 await page.getByRole('button',{name:'Capital e data de abertura',exact:true}).click()
 const antes=await (await fetch(process.env.CNPJ_BIZ_MOCK_URL+'/estatisticas')).json()
 await page.getByRole('button',{name:'Buscar empresas',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'Confira'})).toContainText('Confira')
 const depois=await (await fetch(process.env.CNPJ_BIZ_MOCK_URL+'/estatisticas')).json()
 expect(depois.consultas).toBe(antes.consultas)
 await expect(page).not.toHaveURL(/busca=/)
})
