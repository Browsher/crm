import { expect, test, type Page } from '@playwright/test'
import { comBancoGrupos, bancoGruposDoHarness } from './dados-grupos'
import { criarUsuarioComSenha } from '../integracao/ajuda'

test.describe.configure({ mode: 'serial' })
const nome = 'Armarinhos e variedades Aurora com nome completo para o vendedor (fictícia)'
const grupo = 'Armarinhos e variedades · Brás · Grupo de origem completo para conferir reticências'
const grupoRecente = 'Empresas · Brasil'
let ids:string[] = [], legado:string
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
 ids=await comBancoGrupos(async c=>{
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

test('Últimas buscas inclui cinco não importadas; desktop útil, popup e retomada automática sem nova aquisição',async({page},info)=>{
 test.setTimeout(120000)
 const erros:string[]=[];page.on('pageerror',e=>erros.push(e.message))
 await page.setViewportSize({width:1920,height:1080});await entrar(page)
 const secao=page.getByRole('region',{name:'Últimas buscas',exact:true}),cards=secao.locator('[data-empresa-recente]')
 await expect(page.getByRole('heading',{name:'Todas as minhas empresas',exact:true})).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Últimas buscas',exact:true})).toHaveCount(1)
 await expect(cards).toHaveCount(3);await expect(cards.first().getByRole('heading')).toHaveAttribute('title',nome)
 await expect(cards.first().locator('[data-grupo-origem]')).toHaveText(grupoRecente)
 expect(await comBancoGrupos(async c=>(await c.query('SELECT grupo_id FROM busca_empresa WHERE id=$1',[legado])).rows[0].grupo_id)).toBeNull()
 await expect(secao).not.toContainText('ALHEIA');await expect(secao).not.toContainText('Somente GOOGLE');await expect(secao).not.toContainText('Em atendimento')
 for(const width of [1920,1440,900,800,784,783,782,736,600,390,320]){
  await page.setViewportSize({width,height:width===1920?1080:900});const espaco=(await secao.boundingBox())!.width
  await expect(cards).toHaveCount(espaco>670?3:espaco>480?2:1)
  for(const tema of ['light','dark']){
   await page.getByRole('combobox',{name:/Tema/}).selectOption(tema);await secao.scrollIntoViewIfNeeded()
   await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0)
   const medidas=await cards.evaluateAll(els=>els.map(el=>{
    const r=el.getBoundingClientRect(),h=el.querySelector('h3')!,g=el.querySelector('[data-grupo-origem]')!
    const [identidade,meta,acao]=Array.from(el.children).map(e=>e.getBoundingClientRect())
    return {quadrado:Math.abs(r.width-r.height)<1,semOverflow:el.scrollHeight<=el.clientHeight+1,semSobreposicao:meta.top>=identidade.bottom-1&&acao.top>=meta.bottom-1,linhaNome:getComputedStyle(h).whiteSpace,linhaGrupo:getComputedStyle(g).whiteSpace,nome:Array.from(h.textContent!).length,grupo:Array.from(g.textContent!).length}
   }))
   for(const m of medidas){expect(m.quadrado).toBe(true);expect(m.semOverflow).toBe(true);expect(m.semSobreposicao).toBe(true);expect(m.linhaNome).toBe('nowrap');expect(m.linhaGrupo).toBe('nowrap');expect(m.nome).toBeLessThanOrEqual(espaco>=1120?80:36);expect(m.grupo).toBeLessThanOrEqual(espaco>=1120?120:40)}
   const extra=cards.first().locator('[data-desktop-dados]')
   if(espaco>=1120)await expect(extra).toBeVisible();else await expect(extra).not.toBeVisible()
   if([1920,736,390].includes(width))await secao.screenshot({path:info.outputPath(`ultimas-${width}-${tema}.png`)})
  }
 }
 await page.setViewportSize({width:1920,height:1080});await expect(cards).toHaveCount(3)
 const antes=await chamadas(),url=page.url(),abrir=cards.first().getByRole('button',{name:`Ver empresa: ${nome}`,exact:true})
 await abrir.click();const d=page.getByRole('dialog',{name:nome,exact:true})
 await expect(d).toBeVisible();await expect(d).toContainText(grupoRecente);await expect(d).toContainText('84.200.000/0000-00')
 await expect(d.getByRole('checkbox')).toHaveCount(0)
 await d.getByRole('button',{name:'Concluir inclusão',exact:true}).click()
 await expect(d.getByText('5 empresas novas. A lista reúne 5 empresas.',{exact:true})).toBeVisible()
 await expect(d.getByRole('link',{name:'Prospectar esta lista',exact:true})).toBeVisible()
 const conferir=()=>comBancoGrupos(async c=>(await c.query(`SELECT b.grupo_id,(SELECT count(*)::int FROM grupo_importacao_empresa g WHERE g.grupo_id=b.grupo_id) total FROM busca_empresa b WHERE b.id=$1`,[legado])).rows[0])
 expect((await conferir()).total).toBe(5);await expect(page).toHaveURL(url)
 await page.keyboard.press('Escape');await expect(d).not.toBeVisible();await expect(abrir).toBeFocused()
 await page.reload();await expect(cards).toHaveCount(3);expect((await conferir()).total).toBe(5);expect(await chamadas()).toBe(antes)
 await cards.nth(2).getByRole('button',{name:/Ver empresa:/}).click();await page.setViewportSize({width:390,height:900});await expect(cards).toHaveCount(1)
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(secao).toBeFocused()
 await page.setViewportSize({width:1920,height:1080});await expect(cards).toHaveCount(3)
 const vistos=await cards.evaluateAll(els=>els.map(e=>e.getAttribute('data-empresa-recente')))
 for(let i=0;i<3;i++){await secao.getByRole('button',{name:'Próximas empresas',exact:true}).click();vistos.push(...await cards.evaluateAll(els=>els.map(e=>e.getAttribute('data-empresa-recente'))))}
 expect(vistos).toEqual(ids.slice(0,11));const todas=secao.getByRole('link',{name:'Ver todas buscas',exact:true})
 await expect(todas).toHaveAttribute('href','/fila/localizar?origem=banco');await expect(secao.getByRole('button',{name:'Próximas empresas',exact:true})).toBeDisabled()
 await todas.click();await expect(page).toHaveURL('/fila/localizar?origem=banco');expect(erros).toEqual([])
})

test('sem resultados não cria cards fictícios e conserva o histórico completo',async({page})=>{
 await entrar(page,'carrosselvazioe2e');const secao=page.getByRole('region',{name:'Últimas buscas',exact:true})
 await expect(secao.locator('[data-empresa-recente]')).toHaveCount(0);await expect(secao).toContainText('As empresas encontradas nas suas buscas aparecerão aqui.')
 await expect(secao.getByRole('link',{name:'Ver todas buscas',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Buscar empresas',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Ver histórico de buscas',exact:true}).click();await expect(page.getByRole('dialog',{name:'Histórico de buscas',exact:true})).toBeVisible()
 await expect(page.getByRole('dialog')).toContainText('Nenhuma busca no banco de empresas realizada ainda.')
})
