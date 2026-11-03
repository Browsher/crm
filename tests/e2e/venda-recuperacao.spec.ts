import { expect, test } from '@playwright/test'
import { comAdmin } from '../../src/server/db/admin'
import { exigirAdminLocal } from './ambiente'
import { randomUUID } from 'node:crypto'
import { gerarHash } from '../../src/server/autenticacao/senha'
import { comoUsuario } from '../../src/server/db/como-usuario'
async function sql(texto:string,valores:unknown[]=[]){const url=process.env.DATABASE_URL_ADMIN!;exigirAdminLocal(url);return comAdmin(url,c=>c.query(texto,valores))}
const pasta='.superpowers/sdd/2026-11-03-simplificacao-fluxos-crm/task-4-captures'

const senha='Senha-e2e-2026',hash=gerarHash(senha)
let cenario:{empresa:string;ator:string;negociacao:string;email:string}
test.beforeEach(async()=>{
 const apelido='vendarecuperacao-'+randomUUID().slice(0,8),email=apelido+'@teste.local',empresa=randomUUID()
 const [{id:ator}]=(await sql("INSERT INTO usuario(nome,email,papel,senha_provisoria_pendente) VALUES($1,$2,'vendedor',false) RETURNING id",[apelido,email])).rows
 await sql('INSERT INTO autenticacao.credencial(usuario_id,senha_hash) VALUES($1,$2)',[ator,await hash])
 await sql("INSERT INTO empresa(id,razao_social,telefone) VALUES($1,'Venda Recuperável','11999990000')",[empresa])
 await sql("WITH grupo AS (INSERT INTO grupo_importacao(nome) VALUES('Origem exclusiva venda recuperável') RETURNING id) INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) SELECT id,$1 FROM grupo",[empresa])
 await sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[empresa,ator])
 const r=await comoUsuario(ator,e=>e<{r:{ok:boolean}}>("SELECT contato_registrar_direto($1,$2,1,'interessado',NULL,'Retornar após venda','2030-01-01') AS r",[empresa,randomUUID()]))
 expect(r.linhas[0].r.ok).toBe(true)
 const [{id:negociacao}]=(await sql('SELECT id FROM negociacao WHERE empresa_id=$1',[empresa])).rows
 cenario={empresa,ator,negociacao,email}
})

test('primeira venda com resposta recebida abre ficha após um único recuo da guarda',async({page})=>{
 const {empresa,negociacao:id}=cenario
 await page.goto('/login');await page.getByLabel('E-mail').fill(cenario.email);await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL('/meu-dia')
 await page.goto('/funil')
 await page.getByRole('combobox',{name:'Tema do Funil',exact:true}).selectOption('light')
 await page.goto('/funil?negociacao='+id)
 await page.setViewportSize({width:820,height:900})
 await page.getByRole('button',{name:'Registrar venda',exact:true}).click()
 await page.getByLabel('Valor em reais').fill('abc');await page.getByLabel('Data da venda').fill('2026-01-01')
 await page.getByRole('button',{name:'Conferir venda'}).click();await page.getByRole('button',{name:'Confirmar venda',exact:true}).click()
 await expect(page.getByRole('dialog')).toContainText('Informe o valor em reais')
 expect((await sql('SELECT count(*)::int AS n FROM venda WHERE empresa_id=$1',[empresa])).rows[0].n).toBe(0)
 expect(await page.evaluate(ator=>sessionStorage.getItem('crm:venda:v1:'+ator),cenario.ator)).toBeNull()
 await page.getByRole('button',{name:'Corrigir dados'}).click();await page.getByLabel('Valor em reais').fill('81,50')
 await page.getByRole('button',{name:'Conferir venda'}).click()
 await page.evaluate(()=>{(window as unknown as {popstates:number}).popstates=0;window.addEventListener('popstate',()=>{(window as unknown as {popstates:number}).popstates++})})
 await page.getByRole('button',{name:'Confirmar venda',exact:true}).click()
 await expect(page).toHaveURL('/carteira/'+empresa+'?venda=registrada')
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.getByRole('main')).toContainText('Venda registrada. Confira o histórico')
 expect(await page.evaluate(()=>(window as unknown as {popstates:number}).popstates)).toBe(1)
 expect((await sql('SELECT count(*)::int AS n FROM venda WHERE empresa_id=$1',[empresa])).rows[0].n).toBe(1)
 await page.screenshot({path:`${pasta}/primeira-confirmada-tablet-claro.png`,fullPage:true})
 await page.reload();await expect(page).toHaveURL('/carteira/'+empresa+'?venda=registrada');await expect(page.getByRole('heading',{name:'Venda Recuperável',exact:true})).toBeVisible()
})

test('vendas perdidas sobrevivem reload, confirmam uma vez e conservam destino e filtros',async({page})=>{
 test.setTimeout(120_000)
 page.on('dialog',dialog=>dialog.accept())
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'})
 await page.goto('/login');await page.getByLabel('E-mail').fill(cenario.email);await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL('/meu-dia')
 const {empresa,negociacao,ator}=cenario
 await page.goto('/funil')
 await page.getByRole('combobox',{name:'Tema do Funil',exact:true}).selectOption('dark')
 await page.goto(`/funil?negociacao=${negociacao}&origem=teste#colunas`)
 await expect(page.getByRole('dialog')).toContainText('Venda Recuperável')
 await page.getByRole('button',{name:'Registrar venda',exact:true}).click()
 await page.getByLabel('Valor em reais').fill('123,45');await page.getByLabel('Data da venda').fill('2026-01-01');await page.getByLabel('Observação (opcional)').fill('Primeira venda preservada')
 await page.getByRole('button',{name:'Conferir venda'}).click()
 await page.evaluate(()=>{
  const original=Storage.prototype.setItem;let falhar=true
  Storage.prototype.setItem=function(chave,valor){if(falhar&&chave.startsWith('crm:venda:')){falhar=false;throw Error('quota de teste')}return original.call(this,chave,valor)}
 })
 await page.getByRole('button',{name:'Confirmar venda',exact:true}).click()
 await expect(page.getByRole('dialog')).toContainText('Não foi possível armazenar')
 expect((await sql('SELECT count(*)::int AS n FROM venda WHERE empresa_id=$1',[empresa])).rows[0].n).toBe(0)
 let liberar!:()=>void,posts=0
 const liberarResposta=new Promise<void>(r=>liberar=r)
 await page.route('**/funil*',async route=>{
  if(route.request().method()!=='POST'||!route.request().postData()?.includes('123,45'))return route.continue()
  posts++
  if(posts!==1)return route.continue()
  await route.fetch();await liberarResposta;await route.abort('failed')
 })
 await page.getByRole('button',{name:'Confirmar venda',exact:true}).click()
 await expect(page.getByRole('dialog').getByRole('button',{name:'Registrando...',exact:true})).toBeDisabled()
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible()
 await expect.poll(async()=>(await sql('SELECT count(*)::int AS n FROM venda WHERE empresa_id=$1',[empresa])).rows[0].n).toBe(1)
 liberar()
 await expect(page.getByRole('dialog')).toContainText('Não foi possível confirmar o resultado')
 await expect(page.getByRole('button',{name:'Corrigir dados'})).toHaveCount(0)
 const original=await page.evaluate(ator=>JSON.parse(sessionStorage.getItem('crm:venda:v1:'+ator)!),ator)
 expect(original.alvo).toEqual({tipo:'primeira',negociacaoId:negociacao})
 expect(original.entrada).toEqual({valor:'123,45',data:'2026-01-01',observacao:'Primeira venda preservada'})
 await page.screenshot({path:`${pasta}/primeira-perdida-mobile.png`,fullPage:true})
 await page.reload();await page.getByRole('button',{name:'Fechar mantendo envio',exact:true}).click()
 await expect(page).toHaveURL('/funil?origem=teste#colunas')
 await expect(page.getByRole('heading',{name:'Nenhuma negociação aberta',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Confirmar venda anterior',exact:true})).toBeVisible()
 expect(posts).toBe(1)
 // O destino não vem do empresaId editável no storage.
 await page.evaluate(ator=>{const chave='crm:venda:v1:'+ator;const c=JSON.parse(sessionStorage.getItem(chave)!);c.empresaId='00000000-0000-4000-8000-000000000999';sessionStorage.setItem(chave,JSON.stringify(c))},ator)
 await page.screenshot({path:`${pasta}/recuperacao-funil-vazio-mobile.png`,fullPage:true})
 const confirmar=page.getByRole('button',{name:'Confirmar venda anterior',exact:true});await confirmar.focus();await confirmar.press('Enter')
 await expect(page).toHaveURL(`/carteira/${empresa}?venda=registrada`)
 await expect(page.getByRole('main')).toContainText('Venda registrada. Confira o histórico')
 await expect(page.getByRole('heading',{name:'Venda Recuperável',exact:true})).toBeVisible()
 expect(posts).toBe(2)
 expect((await sql('SELECT count(*)::int AS n FROM venda WHERE chave=$1',[original.chave])).rows[0].n).toBe(1)
 expect(await page.evaluate(ator=>sessionStorage.getItem('crm:venda:v1:'+ator),ator)).toBeNull()

 const contexto=`/carteira/${empresa}?nome=Aurora&retorno=hoje#historico`
 await page.goto(contexto);await page.setViewportSize({width:820,height:900})
 await page.getByRole('button',{name:'Registrar venda',exact:true}).click()
 await page.getByLabel('Valor em reais').fill('250,50');await page.getByLabel('Data da venda').fill('2026-01-02');await page.getByLabel('Observação (opcional)').fill('Recompra preservada')
 await page.getByRole('button',{name:'Conferir venda'}).click()
 let recompras=0
 await page.route('**/carteira/'+empresa+'*',async route=>{
  if(route.request().method()!=='POST'||!route.request().postData()?.includes('250,50'))return route.continue()
  recompras++;if(recompras!==1)return route.continue()
  await route.fetch();await route.abort('failed')
 })
 await page.getByRole('button',{name:'Confirmar venda',exact:true}).click()
 await expect(page.getByRole('dialog')).toContainText('Não foi possível confirmar o resultado')
 await expect(page.getByRole('button',{name:'Corrigir dados'})).toHaveCount(0)
 const recompra=await page.evaluate(ator=>JSON.parse(sessionStorage.getItem('crm:venda:v1:'+ator)!),ator)
 expect(recompra.alvo).toEqual({tipo:'recompra'});expect(recompra.chave).not.toBe(original.chave)
 await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);expect(recompras).toBe(1)
 await page.getByRole('button',{name:'Confirmar venda anterior',exact:true}).click()
 await expect(page).toHaveURL(contexto)
 await expect(page.getByRole('main')).toContainText('Venda registrada.')
 await expect(page.getByRole('button',{name:'Confirmar venda anterior',exact:true})).toHaveCount(0)
 for(const width of [390,820,1280]){
  await page.setViewportSize({width,height:900})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`${pasta}/recompra-confirmada-${width}.png`,fullPage:true})
 }
 expect(recompras).toBe(2)
 expect((await sql('SELECT count(*)::int AS n FROM venda WHERE chave=$1',[recompra.chave])).rows[0].n).toBe(1)
 expect((await sql('SELECT count(*)::int AS n FROM venda WHERE empresa_id=$1',[empresa])).rows[0].n).toBe(2)
 await expect(page.getByRole('link',{name:'Voltar para a carteira',exact:true})).toHaveAttribute('href','/carteira?nome=Aurora&retorno=hoje')
})