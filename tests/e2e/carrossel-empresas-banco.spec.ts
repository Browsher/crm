import { expect, test, type Page } from '@playwright/test'
import { comBancoGrupos, bancoGruposDoHarness } from './dados-grupos'
import { criarUsuarioComSenha } from '../integracao/ajuda'

const nome = 'Armarinhos e variedades Aurora com nome completo para o vendedor (fictícia)'
const grupo = 'Armarinhos e variedades · Brás · Grupo de origem completo para conferir reticências'
test.describe.configure({ mode: 'serial' })
let ids: string[] = []
test.beforeAll(async () => {
  const banco = bancoGruposDoHarness()
  const eu = await criarUsuarioComSenha(banco, 'vendedor', 'carrossele2e', 'Senha-e2e-2026')
  const outro = await criarUsuarioComSenha(banco, 'vendedor', 'carrosseloutroe2e', 'Senha-e2e-2026')
  const vazio = await criarUsuarioComSenha(banco, 'vendedor', 'carrosselvazioe2e', 'Senha-e2e-2026')
  await banco.sql('INSERT INTO busca_empresa_limite(usuario_id,limite_diario,pausado) VALUES($1,0,true)', [vazio.id])
  ids = await comBancoGrupos(async c => {
    const empresas: string[] = []
    for (let i = 0; i < 14; i++) {
      const e = (await c.query(`INSERT INTO empresa(cnpj,razao_social,telefone,cnae_principal)
        VALUES($1,$2,'11988887777','4755502') RETURNING id`, [String(84000000000000 + i), i === 12 ? nome : i === 13 ? 'Empresa ALHEIA (fictícia)' : `Empresa recente ${i} (fictícia)`])).rows[0].id
      empresas.push(e)
      await c.query(`INSERT INTO empresa_dados_cadastrais(empresa_id,fonte,coletado_em,porte,data_abertura,bairro,cidade,uf,telefones)
        VALUES($1,'Casa dos Dados',now(),'ME','2012-01-01','Brás','São Paulo','SP','[]')`, [e])
      const g = (await c.query('INSERT INTO grupo_importacao(nome) VALUES($1) RETURNING id', [i === 12 ? grupo : `Grupo recente ${i} (fictício)`])).rows[0].id
      await c.query('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [g,e])
      await c.query(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,grupo_id,criado_em)
        VALUES($1,$2,jsonb_build_object('palavra','Armarinhos'),1,'concluida',$3,now()+$4*interval '1 minute')`, [i === 13 ? outro.id : eu.id, i === 12 ? grupo : `Busca ${i} (fictícia)`,g,i])
    }
    await c.query('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [empresas[12],eu.id])
    await c.query('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,100,gen_random_uuid())', [empresas[12],eu.id])
    const google = (await c.query(`INSERT INTO empresa(razao_social,telefone) VALUES('Somente GOOGLE (fictícia)','11988887777') RETURNING id`)).rows[0].id
    const p = (await c.query(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf) VALUES($1,'2026-10-27','Somente Google','Brás','São Paulo','SP') RETURNING id`,[eu.id])).rows[0].id
    await c.query(`INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,'{}','entregue',now()+interval '1 day')`,[p,google])
    return empresas.slice(0,13).reverse()
  })
})
async function entrar(page: Page, apelido='carrossele2e') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${apelido}@teste.local`)
  await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026')
  await page.getByRole('button',{name:'Entrar',exact:true}).click()
  await expect(page).toHaveURL('/meu-dia')
  await page.goto('/fila/buscar?fonte=banco')
}

test('11 empresas pessoais, nome em destaque, detalhes sem navegar e último atalho filtrado',async({page},info)=>{
 test.setTimeout(90000)
 const erros:string[]=[];page.on('pageerror',e=>erros.push(e.message))
 await page.setViewportSize({width:1920,height:1080})
 await entrar(page)
 const secao=page.getByRole('region',{name:'Todas as minhas empresas',exact:true})
 const cards=secao.locator('[data-empresa-recente]')
 await expect(cards).toHaveCount(3)
 await expect(cards.first().getByRole('heading')).toHaveAttribute('title',nome)
 await expect(cards.first().getByText('Cliente',{exact:true})).toBeVisible()
 await expect(secao.getByText('Em atendimento',{exact:true})).toHaveCount(0)
 await expect(secao).not.toContainText('ALHEIA')
 await expect(secao).not.toContainText('Somente GOOGLE')
 await expect(page.getByText('Sua pesquisa fica salva no histórico',{exact:true})).toHaveCount(0)
 for(const width of [1920,736,704,703,702,600,390,320]) {
   await page.setViewportSize({width,height:width===1920?1080:900})
   const espaco = (await secao.boundingBox())!.width
   await expect(cards).toHaveCount(espaco>670?3:espaco>480?2:1)
   for(const tema of ['light','dark']) {
     await page.getByRole('combobox',{name:/Tema/}).selectOption(tema)
     await secao.scrollIntoViewIfNeeded()
     await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0)
     const medidas=await cards.evaluateAll(els=>els.map(el=>{
       const r=el.getBoundingClientRect();const h=el.querySelector('h3')!;const g=el.querySelector('[data-grupo-origem]')!
       const [identidade,metadados,acao]=Array.from(el.children).map(e=>e.getBoundingClientRect())
       return {semSobreposicao:metadados.top>=identidade.bottom-1&&acao.top>=metadados.bottom-1,quadrado:Math.abs(r.width-r.height)<1,semOverflow:el.scrollHeight<=el.clientHeight+1,linhaNome:getComputedStyle(h).whiteSpace,linhaGrupo:getComputedStyle(g).whiteSpace,nome:Array.from(h.textContent!).length,grupo:Array.from(g.textContent!).length}
     }))
     for(const m of medidas){expect(m.semSobreposicao).toBe(true);expect(m.quadrado).toBe(true);expect(m.semOverflow).toBe(true);expect(m.linhaNome).toBe('nowrap');expect(m.linhaGrupo).toBe('nowrap');expect(m.nome).toBeLessThanOrEqual(36);expect(m.grupo).toBeLessThanOrEqual(40)}
     if(width===1920||width===736||width===390)await secao.screenshot({path:info.outputPath(`carrossel-${width}-${tema}.png`)})
   }
 }
 await page.setViewportSize({width:1920,height:1080})
 await expect(cards).toHaveCount(3)
 const url=page.url()
 const abrir=cards.first().getByRole('button',{name:`Ver empresa: ${nome}`,exact:true})
 await abrir.click()
 const d=page.getByRole('dialog',{name:nome,exact:true})
 await expect(d).toBeVisible();await expect(d).toContainText(grupo)
 await expect(d).toContainText('84.000.000/0000-12')
 await expect(page).toHaveURL(url)
 await page.keyboard.press('Escape')
 await expect(d).not.toBeVisible();await expect(abrir).toBeFocused()
 const vistos=await cards.evaluateAll(els=>els.map(e=>e.getAttribute('data-empresa-recente')))
 for(let i=0;i<3;i++){
   await secao.getByRole('button',{name:'Próximas empresas',exact:true}).click()
   vistos.push(...await cards.evaluateAll(els=>els.map(e=>e.getAttribute('data-empresa-recente'))))
 }
 expect(vistos).toEqual(ids.slice(0,11))
 const todas=secao.getByRole('link',{name:'Ver todas buscas',exact:true})
 await expect(todas).toHaveAttribute('href','/fila/localizar?origem=banco')
 await expect(secao.getByRole('button',{name:'Próximas empresas',exact:true})).toBeDisabled()
 await todas.click();await expect(page).toHaveURL('/fila/localizar?origem=banco')
 expect(erros).toEqual([])
})

test('sem empresas há apenas o atalho, mesmo sem cota e com pausa',async({page})=>{
 await entrar(page,'carrosselvazioe2e')
 const secao=page.getByRole('region',{name:'Todas as minhas empresas',exact:true})
 await expect(secao.locator('[data-empresa-recente]')).toHaveCount(0)
 await expect(secao).toContainText('Suas empresas importadas aparecerão aqui.')
 await expect(secao.getByRole('link',{name:'Ver todas buscas',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Buscar empresas',exact:true})).toBeDisabled()
})
