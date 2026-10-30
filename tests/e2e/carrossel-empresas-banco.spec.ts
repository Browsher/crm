import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
const capturas = resolve('.superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-8-captures')
mkdirSync(capturas, { recursive: true })
import { expect, test, type Page } from '@playwright/test'
import { comBancoGrupos, bancoGruposDoHarness } from './dados-grupos'
import { criarUsuarioComSenha } from '../integracao/ajuda'

test.describe.configure({ mode: 'serial' })
const nome = 'Armarinhos e variedades Aurora com nome completo para o vendedor (fictícia)'
const grupo = 'Armarinhos e variedades · Brás · Grupo de origem completo para conferir reticências'
const grupoRecente = 'Empresas · Brasil'
let legado:string
function dados(cnpj:string,nome:string,indice:number) {
 return {cnpj,razao_social:nome,nome_fantasia:null,telefone:String(11960000100+indice),telefones:[String(11960000100+indice)],email:`contato${indice}@exemplo.test`,cnae_principal:'4755502',cep:'01001000',situacao:'ATIVA',porte:'ME',data_abertura:'2012-01-01',logradouro:'Rua fictícia',numero:'10',complemento:null,bairro:'Brás',cidade:'São Paulo',uf:'SP',detalhes:{}}
}
const filtros = {palavra:'Armarinhos',cnae:'',uf:'SP',cidade:'São Paulo',bairro:'Brás',porte:'',tipo:'',contato:'telefoneoucelular',quantidade:1,offset:0}
test.beforeAll(async()=>{
 const banco=bancoGruposDoHarness()
 const eu=await criarUsuarioComSenha(banco,'vendedor','carrossele2e','Senha-e2e-2026')
 const outro=await criarUsuarioComSenha(banco,'vendedor','carrosseloutroe2e','Senha-e2e-2026')
 const vazio=await criarUsuarioComSenha(banco,'vendedor','carrosselvazioe2e','Senha-e2e-2026')
 await banco.sql('INSERT INTO busca_empresa_limite(usuario_id,limite_diario,pausado) VALUES($1,0,true),($2,100,false)',[vazio.id,eu.id])
 await comBancoGrupos(async c=>{
  const empresas:string[]=[],registros:string[]=[]
  for(let i=0;i<14;i++){
   const cnpj=String(84000000000000+i),titulo=i===12?'Cliente Aurora (fictício)':i===13?'Empresa ALHEIA (fictícia)':`Empresa recente ${i} (fictícia)`
   const e=(await c.query(`INSERT INTO empresa(cnpj,razao_social,telefone,cnae_principal) VALUES($1,$2,$3,'4755502') RETURNING id`,[cnpj,titulo,String(11960000300+i)])).rows[0].id
   empresas.push(e)
   const g=(await c.query('INSERT INTO grupo_importacao(nome) VALUES($1) RETURNING id',[i===12?grupo:`Grupo recente ${i} (fictício)`])).rows[0].id
   await c.query('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)',[g,e])
   const b=(await c.query(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,grupo_id,empresas,criado_em) VALUES($1,$2,$3,1,'concluida',$4,$5,now()+$6*interval '1 minute') RETURNING id`,[i===13?outro.id:eu.id,i===12?grupo:`Busca ${i} (fictícia)`,JSON.stringify(filtros),g,JSON.stringify([dados(cnpj,titulo,100+i)]),i])).rows[0].id
   if(i<13)registros.push(b+':'+cnpj)
  }
  await c.query('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)',[empresas[12],eu.id])
  await c.query('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,100,gen_random_uuid())',[empresas[12],eu.id])
  const candidatas=Array.from({length:5},(_,i)=>dados(String(84200000000000+i),i===0?nome:`Empresa encontrada ${i} (fictícia)`,i))
  legado=(await c.query(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas,criado_em) VALUES($1,$2,$3,5,'concluida',$4,now()+interval '30 minutes') RETURNING id`,[eu.id,grupoRecente,JSON.stringify({...filtros,quantidade:5}),JSON.stringify(candidatas)])).rows[0].id
  const google=(await c.query(`INSERT INTO empresa(razao_social,telefone) VALUES('Somente GOOGLE (fictícia)','11988887777') RETURNING id`)).rows[0].id
  const plan=(await c.query(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf) VALUES($1,'2026-10-27','Somente Google','Brás','São Paulo','SP') RETURNING id`,[eu.id])).rows[0].id
  await c.query(`INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,'{}','entregue',now()+interval '1 day')`,[plan,google])
  return [...candidatas.map(e=>legado+':'+e.cnpj),...registros.reverse()]
 })
})
async function entrar(page:Page,apelido='carrossele2e'){
 await page.goto('/login');await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
 await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click()
 await expect(page).toHaveURL('/meu-dia');await page.goto('/fila/buscar?fonte=banco')
}
const chamadas=async()=>(await(await fetch(process.env.CNPJ_BIZ_MOCK_URL+'/estatisticas')).json()).consultas


test('Últimas buscas usa card comum e detalhe salvo exato sem aquisição ou inclusão implícita',async({page})=>{
 const erros:string[]=[];page.on('pageerror',e=>erros.push(e.message))
 await entrar(page)
 const secao=page.getByRole('region',{name:'Últimas buscas',exact:true}),cards=secao.locator('ul > li')
 await expect(cards).toHaveCount(3)
 await expect(cards.first().getByRole('heading')).toHaveText(nome)
 await expect(cards.first()).toContainText('AtividadeNão informado')
 await expect(cards.first()).toContainText('OrigemBanco')
 await expect(secao).not.toContainText('ALHEIA');await expect(secao).not.toContainText('Somente GOOGLE')
 const antes=await chamadas(),url=page.url(),abrir=cards.first().getByRole('button',{name:'Ver empresa: '+nome,exact:true})
 for(const width of [390,820,1280]){
  await page.setViewportSize({width,height:900})
  for(const tema of ['light','dark']){
   await page.getByRole('combobox',{name:/Tema/}).selectOption(tema)
   await secao.scrollIntoViewIfNeeded()
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   for(const card of await cards.all()) {
    expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
    expect(await card.locator('dl').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1)
    const partes=card.locator('[data-slot="card"] > *')
    const limites=await partes.evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}))
    for(let i=1;i<limites.length;i++)expect(limites[i].top).toBeGreaterThanOrEqual(limites[i-1].bottom-1)
   }
   await secao.screenshot({path:resolve(capturas,'ultimas-'+width+'-'+tema+'.png'),style:'header[class*="topbar"], a[href="#conteudo-fila"] { visibility:hidden; }'})
   await abrir.click()
   const d=page.getByRole('dialog',{name:'Ver empresa',exact:true})
   await expect(d).toContainText(nome)
   await expect(d).toContainText('84.200.000/0000-00')
   await expect(d).toContainText('Não informado')
   await expect(d.getByRole('checkbox')).toHaveCount(0)
   await expect(d.getByRole('button',{name:/Concluir inclusão|Iniciar atendimento|Retomar atendimento/})).toHaveCount(0)
   await d.screenshot({path:resolve(capturas,'detalhe-longo-'+width+'-'+tema+'.png')})
   await page.keyboard.press('Escape');await expect(d).not.toBeVisible();await expect(abrir).toBeFocused()
  }
 }
 expect(await chamadas()).toBe(antes)
 expect(await comBancoGrupos(async c=>(await c.query('SELECT grupo_id FROM busca_empresa WHERE id=$1',[legado])).rows[0].grupo_id)).toBeNull()
 await expect(page).toHaveURL(url)
 const vistos:string[]=[]
 for(let i=0;i<4;i++){
  vistos.push(...await cards.getByRole('heading').allTextContents())
  if(i<3)await secao.getByRole('button',{name:'Próximas empresas',exact:true}).click()
 }
 expect(vistos).toHaveLength(11);expect(new Set(vistos).size).toBe(11)
 await expect(secao.getByRole('button',{name:'Próximas empresas',exact:true})).toBeDisabled()
 await secao.getByRole('link',{name:'Ver todas as empresas',exact:true}).click()
 await expect(page).toHaveURL('/fila/localizar?origem=banco');expect(erros).toEqual([])
})

test('sem resultados não cria cards fictícios e conserva o histórico completo',async({page})=>{
 await entrar(page,'carrosselvazioe2e');const secao=page.getByRole('region',{name:'Últimas buscas',exact:true})
 await expect(secao.locator('ul > li')).toHaveCount(0)
 await expect(secao).toContainText('As empresas encontradas nas suas buscas aparecerão aqui.')
 await expect(secao.getByRole('link',{name:'Ver todas as empresas',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Buscar empresas',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Ver histórico de buscas',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Histórico de buscas',exact:true})).toContainText('Nenhuma busca no banco de empresas realizada ainda.')
})
