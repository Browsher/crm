import { expect,test,type Page } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness,comBancoGrupos,criarListaHistorica } from './dados-grupos'
const nomeLista='Mooca | Jornada comercial unificada fictícia'
const nomeEmpresa='Aurora Jornada comercial fictícia'
async function entrar(page:Page,apelido:string){await page.goto('/login');await page.getByLabel('E-mail').fill(apelido+'@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL(apelido.includes('gestor')?'/gestao':'/meu-dia')}
test.beforeAll(async()=>{
 const banco=bancoGruposDoHarness()
 for(const [papel,apelido] of [['gestor','catalogogestore2e'],['vendedor','catalogovendedore2e']] as const)if(!(await banco.sql('SELECT id FROM usuario WHERE email=$1',[apelido+'@teste.local'])).length)await criarUsuarioComSenha(banco,papel,apelido,'Senha-e2e-2026')
})
test('cadastro parcial histórico permanece interno; vínculo explícito autoriza atendimento e Funil',async({page,browser})=>{
  await entrar(page,'catalogogestore2e')
  const { autor, empresas } = await comBancoGrupos(async c => {
    const { rows: [gestor] } = await c.query("SELECT id FROM usuario WHERE email='catalogogestore2e@teste.local'")
    const empresas: string[] = []
    for (let i=0;i<23;i++) {
      const placeId='place-catalogo-jornada-'+i
      const { rows: existentes } = await c.query('SELECT empresa_id FROM empresa_origem_google WHERE google_place_id=$1',[placeId])
      if (existentes.length) { empresas.push(existentes[0].empresa_id); continue }
      const nome=nomeEmpresa+(i ? ' '+String(i).padStart(2,'0') : '')
      const { rows: [empresa] } = await c.query("INSERT INTO empresa(nome_fantasia,contato_nome,telefone,email,cnae_principal) VALUES($1,'Pessoa fictícia','11999990601','aurora@teste.local','8888801') RETURNING id",[nome])
      await c.query('INSERT INTO empresa_origem_google(google_place_id,empresa_id) VALUES($1,$2)',[placeId,empresa.id])
      empresas.push(empresa.id)
    }
    return { autor: gestor.id, empresas }
  })
  await criarListaHistorica(nomeLista, empresas, autor)
 const idsAntes=await comBancoGrupos(async c=>(await c.query("SELECT google_place_id,empresa_id FROM empresa_origem_google WHERE google_place_id LIKE 'place-catalogo-jornada-%' ORDER BY 1")).rows)
 expect(idsAntes).toHaveLength(23)
 const contexto=await browser.newContext()
 try{
  const vendedor=await contexto.newPage();await entrar(vendedor,'catalogovendedore2e');await vendedor.goto('/fila/localizar?legado=1')
  await expect(vendedor.getByRole('heading',{name:nomeEmpresa,exact:true})).toHaveCount(0)
  // Atribuição administrativa exclusiva da fixture: cadastro interno não distribui automaticamente.
  await comBancoGrupos(async c=>{await c.query("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) SELECT o.empresa_id,u.id,'legado' FROM empresa_origem_google o CROSS JOIN usuario u WHERE o.google_place_id LIKE 'place-catalogo-jornada-%' AND u.email='catalogovendedore2e@teste.local'")})
  await vendedor.goto('/fila/localizar?nome=Aurora%20Jornada')
  const lista=vendedor.getByRole('region',{name:'Todas as minhas empresas',exact:true}).getByRole('list')
  await expect(lista.getByRole('listitem')).toHaveCount(20)
  await vendedor.getByRole('link',{name:'Próxima página',exact:true}).click()
  await expect(lista.getByRole('listitem')).toHaveCount(3)
  await vendedor.goto('/fila/localizar?nome='+encodeURIComponent(nomeEmpresa+' 21'))
  await vendedor.getByRole('button',{name:'Iniciar atendimento',exact:true}).click()
  await vendedor.getByLabel('Falei, tem interesse',{exact:true}).check()
  await vendedor.getByLabel('Nota',{exact:true}).fill('Atendimento de cadastro parcial')
  await vendedor.getByRole('button',{name:'Registrar',exact:true}).click()
  await expect(vendedor.getByRole('status').filter({hasText:'Atendimento registrado.'})).toBeVisible();await vendedor.goto('/funil')
  await expect(vendedor.getByRole('heading',{name:nomeEmpresa+' 21',exact:true})).toBeVisible()
  await criarListaHistorica('Outra origem da jornada', empresas, autor)
  expect(await comBancoGrupos(async c=>(await c.query("SELECT google_place_id,empresa_id FROM empresa_origem_google WHERE google_place_id LIKE 'place-catalogo-jornada-%' ORDER BY 1")).rows)).toEqual(idsAntes)
 }finally{await contexto.close()}
})
