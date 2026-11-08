import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'
import { EMPRESAS_SEM_INTERESSE as IDS, NUNCA_NEGOCIADA } from './dados-sem-interesse'
async function sql(texto:string,valores:unknown[]=[]){const url=process.env.DATABASE_URL_ADMIN!;exigirAdminLocal(url);return comAdmin(url,c=>c.query(texto,valores))}
async function entrar(page:Page){await page.goto('/login');await page.getByLabel('E-mail').fill('seminteressee2e@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL('/meu-dia')}
const card=(page:Page,nome:string)=>page.locator('[draggable]').filter({has:page.getByRole('heading',{name:nome,exact:true})})
test.beforeEach(async({page})=>entrar(page))
const lateral=(page:Page)=>page.locator('[data-painel-lateral]')
const confirmacao=(page:Page)=>page.getByRole('dialog',{name:'Marcar como Sem interesse?',exact:true})
async function pedirArquivo(page:Page,nome:string){
 await card(page,nome).getByRole('button',{name:'Negociação',exact:true}).click()
 await lateral(page).getByRole('button',{name:'Atendimento e próximo passo',exact:true}).click()
 await lateral(page).getByRole('button',{name:'Sem interesse',exact:true}).click()
}
async function confirmarArquivo(page:Page){await confirmacao(page).getByRole('button',{name:'Confirmar Sem interesse',exact:true}).click()}

for(const [i,etapa]of ['Primeiro contato','Em negociação','Proposta enviada'].entries())test('arquiva '+etapa+' pela ação individual sem criar contato',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await page.goto('/funil')
 const antes=(await sql('SELECT * FROM contato WHERE empresa_id=$1 ORDER BY id',[IDS[i]])).rows
 const vinculo=(await sql('SELECT vendedor_id FROM empresa_vinculo WHERE empresa_id=$1',[IDS[i]])).rows[0]
 if(i<2){
  if(i===1)await page.getByRole('combobox',{name:/Tema/}).selectOption('dark')
  await page.route('**/funil*',async rota=>{
   if(rota.request().method()!=='POST'||!rota.request().postData()?.includes(IDS[i]))return rota.continue()
   const resposta=await rota.fetch()
   await expect(page.locator('[role=status]').filter({hasText:'Confirmando arquivamento'})).toBeAttached()
   await page.evaluate(()=>window.scrollTo(0,0))
   await page.screenshot({path:'.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-3-captures/descarte-desktop-pendente-'+(i===1?'dark':'light')+'.png',fullPage:true,animations:'disabled'})
   await rota.fulfill({response:resposta})
  })
 }
 await expect(page.locator('[data-etapa]')).toHaveCount(3);await expect(page.locator('[data-descarte]')).toHaveCount(1)
 await expect(card(page,'Descarte '+(i+1))).toHaveAttribute('draggable','true')
 await pedirArquivo(page,'Descarte '+(i+1));await confirmarArquivo(page)
 await expect(page.getByRole('status')).toContainText('Empresa marcada como Sem interesse')
 await expect(card(page,'Descarte '+(i+1))).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0)
 expect((await sql('SELECT * FROM contato WHERE empresa_id=$1 ORDER BY id',[IDS[i]])).rows).toEqual(antes)
 expect((await sql('SELECT vendedor_id,agenda_contato_id,arquivada_em IS NOT NULL AS arquivada FROM empresa_vinculo WHERE empresa_id=$1',[IDS[i]])).rows[0]).toEqual({...vinculo,agenda_contato_id:null,arquivada:true})
 expect((await sql('SELECT encerramento FROM negociacao WHERE empresa_id=$1',[IDS[i]])).rows[0].encerramento).toBe('sem_interesse')
 await page.reload();await expect(page.locator('[data-descarte]')).toHaveCount(1)
})

test('arquivo pagina e filtra; empresa nunca negociada é consultável e retoma sem agenda',async({page})=>{
 await page.goto('/fila/sem-interesse')
 await expect(page).toHaveURL('/fila/localizar?disponibilidade=sem_interesse&pagina=1');await expect(page.getByRole('heading',{name:/Arquivo/})).toHaveCount(20)
 await page.getByRole('link',{name:'Próxima página'}).click();await expect(page).toHaveURL(/pagina=2/)
 await expect(page.getByRole('link',{name:'Página anterior'})).toBeVisible()
 await page.getByRole('button',{name:'Editar filtros',exact:true}).first().click()
 await page.getByRole('button',{name:'Mais filtros',exact:true}).click();await page.getByLabel('Nome da empresa').fill('Arquivo 07');await page.getByRole('button',{name:'Pesquisar empresas'}).click()
 await expect(page.getByRole('heading',{name:'Arquivo 07',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:/Arquivo/})).toHaveCount(1)
 await page.getByRole('button',{name:'Ver empresa: Arquivo 07'}).click();await expect(page.getByRole('dialog')).toContainText('Arquivo 07');await page.keyboard.press('Escape')
 expect((await sql('SELECT id FROM negociacao WHERE empresa_id=$1',[NUNCA_NEGOCIADA])).rowCount).toBe(0)
 await page.getByRole('button',{name:'Editar filtros',exact:true}).first().click();await page.getByRole('button',{name:'Mais filtros',exact:true}).click();await page.getByLabel('Nome da empresa').fill('');await page.getByLabel('CNPJ',{exact:true}).fill('00000000009811');await page.getByRole('button',{name:'Pesquisar empresas'}).click()
 await expect(page.getByRole('heading',{name:'Arquivo 07',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Retomar atendimento',exact:true}).focus();await page.keyboard.press('Enter')
 await expect(page).toHaveURL(url=>url.pathname==='/fila/atendimento/'+NUNCA_NEGOCIADA&&url.searchParams.get('disponibilidade')==='sem_interesse')
 expect((await sql('SELECT agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[NUNCA_NEGOCIADA])).rows[0]).toEqual({agenda_contato_id:null,arquivada_em:null})
 expect((await sql('SELECT id FROM negociacao WHERE empresa_id=$1',[NUNCA_NEGOCIADA])).rowCount).toBe(0)
 expect((await sql('SELECT id FROM contato WHERE empresa_id=$1',[NUNCA_NEGOCIADA])).rowCount).toBe(0)
 await page.screenshot({path:'.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-3-captures/retomada-nunca-negociada.png',fullPage:true})
})

test('resposta perdida preserva card/chave no refresh e replay após retomada não arquiva novamente',async({page})=>{
 await page.goto('/funil')
 let perder=true
 await page.route('**/funil',async rota=>{if(rota.request().method()!=='POST'||!rota.request().postData()?.includes(IDS[3])||!perder)return rota.continue();perder=false;await rota.fetch();await rota.abort('failed')})
 await pedirArquivo(page,'Descarte 4');await confirmarArquivo(page)
 await expect(page.getByRole('status')).toContainText('Não foi possível confirmar')
 await expect(card(page,'Descarte 4')).toHaveCount(1)
 const salvo=await page.evaluate(()=>{const chave=Object.keys(sessionStorage).find(k=>k.startsWith('crm:funil:arquivo:v1:'));return chave?sessionStorage.getItem(chave):null})
 expect(salvo).toBeTruthy()
 const comando=JSON.parse(salvo!)
 await comAdmin(process.env.DATABASE_URL_ADMIN!,async c=>{
  await c.query('BEGIN')
  try{
   const {rows:[v]}=await c.query('SELECT vendedor_id,versao FROM empresa_vinculo WHERE empresa_id=$1',[IDS[3]])
   await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('role','app_usuario',true)",[v.vendedor_id])
   const r=await c.query('SELECT empresa_atendimento_retomar($1,$2,$3) AS r',[IDS[3],randomUUID(),v.versao])
   expect(r.rows[0].r.ok).toBe(true);await c.query('COMMIT')
  }catch(e){await c.query('ROLLBACK');throw e}finally{await c.query('RESET ROLE')}
 })
 await page.reload();await expect(card(page,'Descarte 4')).toHaveCount(1)
 await page.getByRole('button',{name:'Confirmar envio anterior',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('Envio anterior confirmado')
 await expect(page.locator('[data-descarte]')).toHaveCount(1)
 expect((await sql('SELECT arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[IDS[3]])).rows[0].arquivada_em).toBeNull()
 expect((await sql('SELECT count(*)::int AS n FROM empresa_atendimento_operacao WHERE chave=$1',[comando.chave])).rows[0].n).toBe(1)
})

test('visual claro/escuro desktop/móvel, dados separados e movimento reduzido',async({page})=>{
 await page.goto('/fila/sem-interesse')
 for(const tema of ['light','dark']){
  await page.getByRole('combobox',{name:/Tema/}).selectOption(tema)
  for(const width of [390,820,1280]){
   await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   await page.screenshot({path:'.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-3-captures/arquivo-'+tema+'-'+width+'.png',fullPage:true,animations:'disabled'})
   await page.screenshot({path:'.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-3-captures/arquivo-'+tema+'-'+width+'-viewport.png',animations:'disabled'})
  }
 }
 await page.goto('/funil');await page.emulateMedia({reducedMotion:'reduce'})
 await expect(page.locator('[data-descarte]')).toHaveCount(1)
 for(const tema of ['light','dark']){
  await page.getByRole('combobox',{name:/Tema/}).selectOption(tema)
  for(const width of [390,820,1280]){
   await page.setViewportSize({width,height:900})
   await page.screenshot({path:'.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-3-captures/funil-'+tema+'-'+width+'.png',fullPage:true,animations:'disabled'})
  }
 }
 const visual=card(page,'Descarte visual')
 await visual.getByRole('button',{name:'Dados da empresa',exact:true}).click()
 await expect(lateral(page).getByRole('button',{name:'Registrar venda',exact:true})).toHaveCount(0)
 await page.keyboard.press('Escape')
 const n=(await sql("SELECT id FROM negociacao WHERE empresa_id='00000000-0000-4000-8000-000000009826' AND encerrada_em IS NULL")).rows[0]
 await page.goto('/funil?negociacao='+n.id)
 await lateral(page).getByRole('button',{name:'Atendimento e próximo passo',exact:true}).click()
 await expect(lateral(page).getByRole('button',{name:'Registrar venda',exact:true})).toBeVisible()
 await page.keyboard.press('Escape')
 await page.keyboard.press('Escape')
 await page.setViewportSize({width:390,height:900})
 await page.getByRole('combobox',{name:/Tema/}).selectOption('dark')
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 let liberar!:()=>void
 const espera=new Promise<void>(r=>liberar=r)
 await page.route('**/funil*',async rota=>{if(rota.request().method()!=='POST'||!rota.request().postData()?.includes('00000000-0000-4000-8000-000000009826'))return rota.continue();const resposta=await rota.fetch();await espera;await rota.fulfill({response:resposta})})
 await pedirArquivo(page,'Descarte visual')
 await confirmacao(page).getByRole('button',{name:'Confirmar Sem interesse',exact:true}).press('Enter')
 await expect(page.getByRole('status')).toContainText('Confirmando arquivamento')
 await page.keyboard.press('Enter')
 await page.evaluate(()=>window.scrollTo(0,0))
 await page.screenshot({path:'.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-3-captures/descarte-mobile-pendente-dark.png',fullPage:true,animations:'disabled'})
 liberar()
 await expect(page.getByRole('status').filter({hasText:'Empresa marcada como Sem interesse'})).toBeVisible()
 await expect(page.locator('[data-efeito-arquivo]')).toHaveCount(0)
 await expect(page.getByRole('status').filter({hasText:'Empresa marcada como Sem interesse'})).toBeVisible()
})

test('toque consulta e retoma empresa do arquivo em dispositivo móvel',async({browser,baseURL})=>{
 const contexto=await browser.newContext({baseURL,hasTouch:true,isMobile:true,viewport:{width:390,height:844}})
 try{
  const page=await contexto.newPage();await entrar(page)
  await page.goto('/fila/sem-interesse?nome=Arquivo+08')
  await page.getByRole('button',{name:'Ver empresa: Arquivo 08'}).tap()
  await expect(page.getByRole('dialog')).toContainText('Arquivo 08')
  await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).tap()
  await page.getByRole('button',{name:'Retomar atendimento',exact:true}).tap()
  await expect(page).toHaveURL(url=>url.pathname==='/fila/atendimento/00000000-0000-4000-8000-000000009812'&&url.searchParams.get('disponibilidade')==='sem_interesse')
  expect((await sql("SELECT agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id='00000000-0000-4000-8000-000000009812'")).rows[0]).toEqual({agenda_contato_id:null,arquivada_em:null})
  await page.goto('/funil')
  await expect(card(page,'Descarte toque')).toHaveAttribute('draggable','false')
  await card(page,'Descarte toque').getByRole('button',{name:'Negociação',exact:true}).tap()
  await lateral(page).getByRole('button',{name:'Atendimento e próximo passo',exact:true}).tap()
  await lateral(page).getByRole('button',{name:'Sem interesse',exact:true}).tap()
  await confirmacao(page).getByRole('button',{name:'Confirmar Sem interesse',exact:true}).tap()
  await expect(page.getByRole('status')).toContainText('Empresa marcada como Sem interesse')
  expect((await sql("SELECT count(*)::int AS n FROM contato WHERE empresa_id='00000000-0000-4000-8000-000000009827'")).rows[0].n).toBe(1)
  await page.screenshot({path:'.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-3-captures/toque-mobile-light.png',fullPage:true,animations:'disabled'})
 }finally{await contexto.close()}
})


test('central oferece quarta origem e consulta canônica, limpar conserva Sem interesse',async({page})=>{
 await page.goto('/fila')
 const origem=page.getByRole('combobox',{name:'Origem das empresas'})
 await expect(origem.locator('option')).toHaveText(['Google e banco de empresas','Buscas no Google','Banco de empresas','Sem interesse'])
 await expect(page.getByRole('link',{name:'Consultar arquivo'})).toHaveCount(0)
 await origem.selectOption('sem_interesse');await page.getByRole('button',{name:'Localizar empresas',exact:true}).click()
 await expect(page).toHaveURL('/fila/localizar?disponibilidade=sem_interesse&pagina=1')
 await expect(page.locator('section[aria-labelledby="minhas-empresas-titulo"] header')).toContainText('Sem interesse')
 await page.getByRole('button',{name:'Mais filtros',exact:true}).click()
 await page.getByLabel('Nome da empresa').fill('Arquivo 10');await page.getByRole('button',{name:'Pesquisar empresas',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Arquivo 10',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Editar filtros',exact:true}).first().click()
 await page.getByRole('link',{name:'Limpar filtros',exact:true}).click()
 await expect(page).toHaveURL('/fila/localizar?disponibilidade=sem_interesse&pagina=1')
})

test('comando legado confirmado no banco sobrevive redirect, filtro inválido e grade sem empresa; replay abre atendimento uma vez',async({page})=>{
 const empresaId='00000000-0000-4000-8000-000000009813',chave=randomUUID()
 const v=(await sql('SELECT vendedor_id,versao FROM empresa_vinculo WHERE empresa_id=$1',[empresaId])).rows[0]
 const comando={id:empresaId,versao:Number(v.versao),chave}
 await comAdmin(process.env.DATABASE_URL_ADMIN!,async c=>{
  await c.query('BEGIN')
  try {
   await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('role','app_usuario',true)",[v.vendedor_id])
   const r=await c.query('SELECT empresa_atendimento_retomar($1,$2,$3) AS r',[empresaId,chave,comando.versao])
   expect(r.rows[0].r.ok).toBe(true);await c.query('COMMIT')
  }catch(e){await c.query('ROLLBACK');throw e}finally{await c.query('RESET ROLE')}
 })
 await page.evaluate(({usuarioId,comando})=>sessionStorage.setItem('crm:retomar-arquivo:v1:'+usuarioId,JSON.stringify(comando)),{usuarioId:v.vendedor_id,comando})
 let posts=0
 page.on('request',r=>{if(r.method()==='POST')posts++})
 await page.goto('/fila/sem-interesse?pagina=invalida&nome=Arquivo+09')
 await expect(page).toHaveURL(/sem-interesse/)
 await expect(page.getByRole('main').getByRole('alert')).toContainText('filtros é inválido')
 await expect(page.getByRole('button',{name:'Confirmar retomada anterior',exact:true})).toBeVisible()
 await page.getByRole('link',{name:'Limpar filtros',exact:true}).click()
 await expect(page).toHaveURL('/fila/localizar?disponibilidade=sem_interesse&pagina=1')
 for(const b of await page.getByRole('button',{name:'Retomar atendimento',exact:true}).all())await expect(b).toBeDisabled()
 await page.goto('/fila/sem-interesse?nome=Arquivo+09&cnpj=00000000009813&nicho=Luz&endereco=Centro&pagina=3')
 await expect(page).toHaveURL('/fila/localizar?nicho=Luz&endereco=Centro&nome=Arquivo+09&cnpj=00000000009813&disponibilidade=sem_interesse&pagina=3')
 await expect(page.getByRole('heading',{name:'Arquivo 09',exact:true})).toHaveCount(0)
 await page.reload()
 await expect(page.getByRole('button',{name:'Confirmar retomada anterior',exact:true})).toBeVisible()
 expect(posts).toBe(0)
 await page.getByRole('button',{name:'Confirmar retomada anterior',exact:true}).click()
 await expect(page).toHaveURL(url=>url.pathname==='/fila/atendimento/'+empresaId&&url.searchParams.get('disponibilidade')==='sem_interesse'&&url.searchParams.get('nome')==='Arquivo 09'&&url.searchParams.get('cnpj')==='00000000009813'&&url.searchParams.get('nicho')==='Luz'&&url.searchParams.get('endereco')==='Centro'&&url.searchParams.get('pagina')==='3')
 expect((await sql('SELECT count(*)::int AS n FROM empresa_atendimento_operacao WHERE chave=$1',[chave])).rows[0].n).toBe(1)
 expect((await sql('SELECT agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[empresaId])).rows[0]).toEqual({agenda_contato_id:null,arquivada_em:null})
 expect((await sql('SELECT id FROM negociacao WHERE empresa_id=$1',[empresaId])).rowCount).toBe(0)
 expect((await sql('SELECT id FROM contato WHERE empresa_id=$1',[empresaId])).rowCount).toBe(0)
 expect(await page.evaluate(usuarioId=>sessionStorage.getItem('crm:retomar-arquivo:v1:'+usuarioId),v.vendedor_id)).toBeNull()
 await page.screenshot({path:'.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-3-captures/legado-confirmado-destino.png',fullPage:true})
 await page.getByRole('link',{name:'Voltar para minhas empresas',exact:true}).click()
 await expect(page).toHaveURL(url=>url.pathname==='/fila/localizar'&&url.searchParams.get('nome')==='Arquivo 09'&&url.searchParams.get('disponibilidade')==='sem_interesse'&&url.searchParams.get('cnpj')==='00000000009813'&&url.searchParams.get('nicho')==='Luz'&&url.searchParams.get('endereco')==='Centro'&&url.searchParams.get('pagina')==='3')
})


for(const [n,situacao,rotulo] of [[11,'a_contatar','Iniciar atendimento'],[12,'atendimento','Continuar atendimento']] as const) test('retomada moderna perdida mantém Provider no snapshot '+situacao+', fora da consulta e durante confirmação',async({page})=>{
 const empresaId='00000000-0000-4000-8000-'+String(9804+n).padStart(12,'0'),nome='Arquivo '+n
 if(situacao==='atendimento')await sql('UPDATE empresa_vinculo SET iniciada_em=now() WHERE empresa_id=$1',[empresaId])
 await page.goto('/fila/localizar?nome='+encodeURIComponent(nome)+'&disponibilidade=sem_interesse&pagina=1')
 let perder=true,posts=0,segurar=false,liberar!:()=>void
 const espera=new Promise<void>(r=>liberar=r)
 page.on('request',r=>{if(r.method()==='POST')posts++})
 await page.route('**/fila/localizar*',async rota=>{
  if(rota.request().method()!=='POST')return rota.continue()
  if(perder){perder=false;await rota.fetch();await rota.abort('failed');return}
  if(segurar){const resposta=await rota.fetch();await espera;await rota.fulfill({response:resposta});return}
  return rota.continue()
 })
 await page.getByRole('button',{name:'Retomar atendimento',exact:true}).click()
 await expect(page.getByText(/Não foi possível confirmar/)).toBeVisible()
 const salvo=await page.evaluate(empresaId=>sessionStorage.getItem('crm:acao-empresa:v1:'+empresaId),empresaId)
 expect(salvo).toBeTruthy();const comando=JSON.parse(salvo!)
 const usuarioId=(await sql('SELECT vendedor_id FROM empresa_vinculo WHERE empresa_id=$1',[empresaId])).rows[0].vendedor_id
 expect(comando).toMatchObject({id:empresaId,tipo:'retomar',usuarioId})
 expect((await sql('SELECT arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[empresaId])).rows[0].arquivada_em).toBeNull()
 await page.reload()
 await expect(page.getByRole('heading',{name:nome,exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Confirmar retomada anterior',exact:true})).toBeVisible()
 expect(posts).toBe(1)
 // Mudar o filtro altera a ação visual, mas não pode trocar o emissor do comando.
 await page.getByRole('button',{name:'Mais filtros',exact:true}).click()
 await page.getByRole('combobox',{name:'Disponibilidade',exact:true}).selectOption('')
 await page.getByRole('button',{name:'Pesquisar empresas',exact:true}).click()
 await expect(page).toHaveURL(url=>url.pathname==='/fila/localizar'&&!url.searchParams.has('disponibilidade'))
 await page.getByRole('button',{name:rotulo,exact:true}).click()
 expect(posts).toBe(1)
 expect(await page.evaluate(empresaId=>sessionStorage.getItem('crm:acao-empresa:v1:'+empresaId),empresaId)).toBe(salvo)
 // Registro identificado de outro ator não ganha autoridade por esse snapshot.
 const alheio=JSON.stringify({...comando,usuarioId:randomUUID()})
 await page.evaluate(({empresaId,alheio})=>sessionStorage.setItem('crm:acao-empresa:v1:'+empresaId,alheio),{empresaId,alheio})
 await page.reload()
 await expect(page.getByRole('button',{name:'Confirmar retomada anterior',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:rotulo,exact:true}).click()
 expect(posts).toBe(1)
 expect(await page.evaluate(empresaId=>sessionStorage.getItem('crm:acao-empresa:v1:'+empresaId),empresaId)).toBe(alheio)
 await page.evaluate(({empresaId,salvo})=>sessionStorage.setItem('crm:acao-empresa:v1:'+empresaId,salvo),{empresaId,salvo:salvo!})
 // Fora do Provider, o card encaminha para a consulta autenticada sem transmitir.
 await page.goto('/fila/atendimento/'+empresaId+'?nome='+encodeURIComponent(nome)+'&pagina=1')
 await page.getByRole('button',{name:rotulo,exact:true}).click()
 expect(posts).toBe(1)
 await page.getByRole('link',{name:'Confirmar em Localizar empresas',exact:true}).click()
 await expect(page).toHaveURL(url=>url.pathname==='/fila/localizar'&&url.searchParams.get('nome')===nome)
 await expect(page.getByRole('button',{name:'Confirmar retomada anterior',exact:true})).toBeVisible()
 segurar=true
 await page.getByRole('button',{name:'Confirmar retomada anterior',exact:true}).click()
 await expect.poll(()=>posts).toBe(2)
 try {
  await expect(page.getByRole('button',{name:'Confirmar retomada anterior',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:rotulo,exact:true}).click()
  expect(posts).toBe(2)
  expect(await page.evaluate(empresaId=>sessionStorage.getItem('crm:acao-empresa:v1:'+empresaId),empresaId)).toBe(salvo)
 }finally{liberar()}
 await expect(page).toHaveURL(url=>url.pathname==='/fila/atendimento/'+empresaId&&url.searchParams.get('nome')===nome&&!url.searchParams.has('disponibilidade'))
 expect(posts).toBe(2)
 expect((await sql('SELECT count(*)::int AS n FROM empresa_atendimento_operacao WHERE chave=$1',[comando.chave])).rows[0].n).toBe(1)
 expect((await sql('SELECT id FROM contato WHERE empresa_id=$1',[empresaId])).rowCount).toBe(0)
 expect((await sql('SELECT id FROM negociacao WHERE empresa_id=$1',[empresaId])).rowCount).toBe(0)
 expect(await page.evaluate(empresaId=>sessionStorage.getItem('crm:acao-empresa:v1:'+empresaId),empresaId)).toBeNull()
 await page.screenshot({path:'.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-3-captures/review-moderna-'+situacao+'.png',fullPage:true})
})

for(const [rota,origem] of [['/fila/sem-interesse',''],['/fila/localizar','origem=sem_interesse&']] as const)for(const disponibilidade of ['disponibilidade=invalida','disponibilidade=sem_interesse&disponibilidade=sem_interesse'])test('erro de disponibilidade não é apagado em '+rota+'?'+origem+disponibilidade,async({page})=>{
 const v=(await sql('SELECT vendedor_id,versao FROM empresa_vinculo WHERE empresa_id=$1',[IDS[0]])).rows[0]
 const comando={id:IDS[0],versao:Number(v.versao),chave:randomUUID()}
 await page.evaluate(({usuarioId,comando})=>sessionStorage.setItem('crm:retomar-arquivo:v1:'+usuarioId,JSON.stringify(comando)),{usuarioId:v.vendedor_id,comando})
 let posts=0;page.on('request',r=>{if(r.method()==='POST')posts++})
 await page.goto(rota+'?'+origem+disponibilidade)
 await expect(page).toHaveURL(rota+'?'+origem+disponibilidade)
 await expect(page.getByRole('main').getByRole('alert')).toContainText('inválido')
 await expect(page.getByRole('button',{name:'Confirmar retomada anterior',exact:true})).toBeVisible()
 await page.getByRole('link',{name:'Limpar filtros',exact:true}).click()
 await expect(page).toHaveURL('/fila/localizar?disponibilidade=sem_interesse&pagina=1')
 await expect(page.getByRole('button',{name:'Confirmar retomada anterior',exact:true})).toBeVisible()
 expect(posts).toBe(0)
})
