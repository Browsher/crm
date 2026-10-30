import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'
import { EMPRESAS_SEM_INTERESSE as IDS, NUNCA_NEGOCIADA } from './dados-sem-interesse'
async function sql(texto:string,valores:unknown[]=[]){const url=process.env.DATABASE_URL_ADMIN!;exigirAdminLocal(url);return comAdmin(url,c=>c.query(texto,valores))}
async function entrar(page:Page){await page.goto('/login');await page.getByLabel('E-mail').fill('seminteressee2e@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL('/meu-dia')}
const card=(page:Page,nome:string)=>page.locator('[draggable]').filter({has:page.getByRole('heading',{name:nome,exact:true})})
test.beforeEach(async({page})=>entrar(page))

for(const [i,etapa]of ['Primeiro contato','Em negociação','Proposta enviada'].entries())test('descarta '+etapa+' no mesmo alvo sem criar contato',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await page.goto('/funil')
 const antes=(await sql('SELECT * FROM contato WHERE empresa_id=$1 ORDER BY id',[IDS[i]])).rows
 const vinculo=(await sql('SELECT vendedor_id FROM empresa_vinculo WHERE empresa_id=$1',[IDS[i]])).rows[0]
 if(i<2){
  if(i===1)await page.getByRole('combobox',{name:/Tema/}).selectOption('dark')
  await page.route('**/funil*',async rota=>{
   if(rota.request().method()!=='POST')return rota.continue()
   const resposta=await rota.fetch()
   await expect(page.locator('[data-descarte]')).toHaveAttribute('data-estado','salvando')
   await page.evaluate(()=>window.scrollTo(0,0))
   await page.screenshot({path:'.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-6-captures/descarte-desktop-pendente-'+(i===1?'dark':'light')+'.png',fullPage:true,animations:'disabled'})
   await rota.fulfill({response:resposta})
  })
 }
 await expect(page.locator('[data-etapa]')).toHaveCount(3);await expect(page.locator('[data-descarte]')).toHaveCount(1)
 await expect(card(page,'Descarte '+(i+1))).toHaveAttribute('draggable','true')
 await card(page,'Descarte '+(i+1)).dragTo(page.locator('[data-descarte]'))
 await expect(page.getByRole('status')).toContainText('Empresa marcada como Sem interesse')
 await expect(card(page,'Descarte '+(i+1))).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0)
 expect((await sql('SELECT * FROM contato WHERE empresa_id=$1 ORDER BY id',[IDS[i]])).rows).toEqual(antes)
 expect((await sql('SELECT vendedor_id,agenda_contato_id,arquivada_em IS NOT NULL AS arquivada FROM empresa_vinculo WHERE empresa_id=$1',[IDS[i]])).rows[0]).toEqual({...vinculo,agenda_contato_id:null,arquivada:true})
 expect((await sql('SELECT encerramento FROM negociacao WHERE empresa_id=$1',[IDS[i]])).rows[0].encerramento).toBe('sem_interesse')
 await page.reload();await expect(page.locator('[data-descarte]')).toHaveAttribute('data-estado','repouso')
})

test('arquivo pagina e filtra; empresa nunca negociada é consultável e retoma sem agenda',async({page})=>{
 await page.goto('/fila/sem-interesse')
 await expect(page.getByRole('heading',{name:/Arquivo/})).toHaveCount(20)
 await page.getByRole('link',{name:'Próxima página'}).click();await expect(page).toHaveURL(/pagina=2/)
 await expect(page.getByRole('link',{name:'Página anterior'})).toBeVisible()
 await page.getByLabel('Nome da empresa').fill('Arquivo 07');await page.getByRole('button',{name:'Pesquisar empresas'}).click()
 await expect(page.getByRole('heading',{name:'Arquivo 07',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:/Arquivo/})).toHaveCount(1)
 await page.getByRole('button',{name:'Ver empresa: Arquivo 07'}).click();await expect(page.getByRole('dialog')).toContainText('Arquivo 07');await page.keyboard.press('Escape')
 expect((await sql('SELECT id FROM negociacao WHERE empresa_id=$1',[NUNCA_NEGOCIADA])).rowCount).toBe(0)
 await page.getByLabel('Nome da empresa').fill('');await page.getByLabel('CNPJ').fill('00000000009811');await page.getByRole('button',{name:'Pesquisar empresas'}).click()
 await expect(page.getByRole('heading',{name:'Arquivo 07',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Retomar atendimento',exact:true}).focus();await page.keyboard.press('Enter')
 await expect(page.getByRole('status')).toContainText('Atendimento retomado')
 expect((await sql('SELECT agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[NUNCA_NEGOCIADA])).rows[0]).toEqual({agenda_contato_id:null,arquivada_em:null})
 expect((await sql('SELECT id FROM negociacao WHERE empresa_id=$1',[NUNCA_NEGOCIADA])).rowCount).toBe(0)
 expect((await sql('SELECT id FROM contato WHERE empresa_id=$1',[NUNCA_NEGOCIADA])).rowCount).toBe(0)
})

test('resposta perdida preserva card/chave no refresh e replay após retomada não arquiva novamente',async({page})=>{
 await page.goto('/funil')
 let perder=true
 await page.route('**/funil',async rota=>{if(rota.request().method()!=='POST'||!perder)return rota.continue();perder=false;await rota.fetch();await rota.abort('failed')})
 await card(page,'Descarte 4').getByRole('button',{name:'Marcar como Sem interesse'}).click()
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
 await expect(page.locator('[data-descarte]')).not.toHaveAttribute('data-estado','sucesso')
 expect((await sql('SELECT arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[IDS[3]])).rows[0].arquivada_em).toBeNull()
 expect((await sql('SELECT count(*)::int AS n FROM empresa_atendimento_operacao WHERE chave=$1',[comando.chave])).rows[0].n).toBe(1)
})

test('visual claro/escuro desktop/móvel, dados separados e movimento reduzido',async({page})=>{
 await page.goto('/fila/sem-interesse')
 for(const tema of ['light','dark']){
  await page.getByRole('combobox',{name:/Tema/}).selectOption(tema)
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   await page.screenshot({path:'.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-6-captures/arquivo-'+tema+'-'+width+'.png',fullPage:true,animations:'disabled'})
   await page.screenshot({path:'.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-6-captures/arquivo-'+tema+'-'+width+'-viewport.png',animations:'disabled'})
  }
 }
 await page.goto('/funil');await page.emulateMedia({reducedMotion:'reduce'})
 await expect(page.locator('[data-descarte]')).toHaveCSS('transition-duration','0s')
 for(const tema of ['light','dark']){
  await page.getByRole('combobox',{name:/Tema/}).selectOption(tema)
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:900})
   await page.screenshot({path:'.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-6-captures/funil-'+tema+'-'+width+'.png',fullPage:true,animations:'disabled'})
  }
 }
 const visual=card(page,'Descarte visual')
 await visual.getByRole('button',{name:'Ver empresa: Descarte visual'}).click()
 await expect(page.getByRole('dialog').getByRole('button',{name:'Registrar venda',exact:true})).toHaveCount(0)
 await page.keyboard.press('Escape')
 const n=(await sql("SELECT id FROM negociacao WHERE empresa_id='00000000-0000-4000-8000-000000009826' AND encerrada_em IS NULL")).rows[0]
 await page.goto('/funil?negociacao='+n.id)
 await expect(page.getByRole('dialog').getByRole('button',{name:'Registrar venda',exact:true})).toBeVisible()
 await page.keyboard.press('Escape')
 await page.setViewportSize({width:390,height:900})
 await page.getByRole('combobox',{name:/Tema/}).selectOption('dark')
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 let liberar!:()=>void
 const espera=new Promise<void>(r=>liberar=r)
 await page.route('**/funil*',async rota=>{if(rota.request().method()!=='POST')return rota.continue();const resposta=await rota.fetch();await espera;await rota.fulfill({response:resposta})})
 await card(page,'Descarte visual').getByRole('button',{name:'Marcar como Sem interesse'}).focus()
 await page.keyboard.press('Enter')
 await expect(page.locator('[data-descarte]')).toHaveAttribute('data-estado','salvando')
 await page.keyboard.press('Enter')
 await page.evaluate(()=>window.scrollTo(0,0))
 await page.screenshot({path:'.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-6-captures/descarte-mobile-pendente-dark.png',fullPage:true,animations:'disabled'})
 liberar()
 await expect(page.getByRole('status')).toContainText('Empresa marcada como Sem interesse')
 await expect(page.getByRole('status')).toBeFocused()
})

test('toque consulta e retoma empresa do arquivo em dispositivo móvel',async({browser})=>{
 const contexto=await browser.newContext({baseURL:'http://localhost:3100',hasTouch:true,isMobile:true,viewport:{width:390,height:844}})
 try{
  const page=await contexto.newPage();await entrar(page)
  await page.goto('/fila/sem-interesse?nome=Arquivo+08')
  await page.getByRole('button',{name:'Ver empresa: Arquivo 08'}).tap()
  await expect(page.getByRole('dialog')).toContainText('Arquivo 08')
  await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).tap()
  await page.getByRole('button',{name:'Retomar atendimento',exact:true}).tap()
  await expect(page.getByRole('status')).toContainText('Atendimento retomado')
  expect((await sql("SELECT agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id='00000000-0000-4000-8000-000000009812'")).rows[0]).toEqual({agenda_contato_id:null,arquivada_em:null})
  await page.goto('/funil')
  await expect(card(page,'Descarte toque')).toHaveAttribute('draggable','false')
  await card(page,'Descarte toque').getByRole('button',{name:'Marcar como Sem interesse'}).tap()
  await expect(page.getByRole('status')).toContainText('Empresa marcada como Sem interesse')
  expect((await sql("SELECT count(*)::int AS n FROM contato WHERE empresa_id='00000000-0000-4000-8000-000000009827'")).rows[0].n).toBe(1)
  await page.screenshot({path:'.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-6-captures/toque-mobile-light.png',fullPage:true,animations:'disabled'})
 }finally{await contexto.close()}
})
