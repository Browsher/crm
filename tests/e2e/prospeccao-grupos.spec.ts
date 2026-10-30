import { expect,test,type Page } from '@playwright/test'
import { criarUsuarioComSenha } from '../integracao/ajuda'
import { bancoGruposDoHarness,comBancoGrupos } from './dados-grupos'
const nomeLista='Mooca | Jornada comercial unificada fictícia'
const nomeEmpresa='Aurora Jornada comercial fictícia'
async function entrar(page:Page,apelido:string){await page.goto('/login');await page.getByLabel('E-mail').fill(apelido+'@teste.local');await page.getByLabel('Senha',{exact:true}).fill('Senha-e2e-2026');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).toHaveURL(apelido.includes('gestor')?'/gestao':'/meu-dia')}
async function estadoImportacao(){return comBancoGrupos(async c=>{const estado=[];for(const t of ['empresa','empresa_origem_google','grupo_importacao','grupo_importacao_empresa'])estado.push((await c.query('SELECT * FROM '+t+' ORDER BY 1,2')).rows);return estado})}
test.beforeAll(async()=>{
 const banco=bancoGruposDoHarness()
 for(const [papel,apelido] of [['gestor','catalogogestore2e'],['vendedor','catalogovendedore2e']] as const)if(!(await banco.sql('SELECT id FROM usuario WHERE email=$1',[apelido+'@teste.local'])).length)await criarUsuarioComSenha(banco,papel,apelido,'Senha-e2e-2026')
})
test('importação parcial permanece interna; vínculo explícito autoriza jornada e reimportação mantém identidade',async({page,browser})=>{
  await entrar(page,'catalogogestore2e')
  await page.goto('/empresas/importar')
  await page.getByLabel('Nome do grupo', { exact:true }).fill(nomeLista)
  await page.getByLabel('Resumo da lista', { exact:true }).fill('Empresas fictícias com nome comercial e contato na Mooca')
  await page.getByLabel('Origem dos dados', { exact:true }).fill('Google Maps fictício com conferência dos contatos')
  await page.getByLabel('Critérios usados', { exact:true }).fill('Segurança eletrônica; informática; automação na Mooca')
  const csv = 'cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal,google_place_id\n'+Array.from({length:23},(_,i)=>`,,${nomeEmpresa}${i ? ` ${String(i).padStart(2,'0')}` : ''},Pessoa fictícia,11999990601,aurora@teste.local,,8888801,place-catalogo-jornada-${i}`).join('\n')+'\n'
  await page.getByLabel('Arquivo Excel ou CSV').setInputFiles({name:'catalogo-ficticio.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
  const antes = await estadoImportacao()
  await page.getByRole('button', { name:'Conferir arquivo', exact:true }).click()
  await expect(page.getByRole('heading', { name:'Confira antes de importar' })).toBeFocused()
  expect(await estadoImportacao()).toEqual(antes)
  await page.getByRole('button', { name:'Confirmar importação', exact:true }).click()
  await expect(page.getByRole('heading', { name:'Importação concluída' })).toBeFocused()

 const idsAntes=await comBancoGrupos(async c=>(await c.query("SELECT google_place_id,empresa_id FROM empresa_origem_google WHERE google_place_id LIKE 'place-catalogo-jornada-%' ORDER BY 1")).rows)
 expect(idsAntes).toHaveLength(23)
 const contexto=await browser.newContext()
 try{
  const vendedor=await contexto.newPage();await entrar(vendedor,'catalogovendedore2e');await vendedor.goto('/fila/localizar?legado=1')
  await expect(vendedor.getByRole('heading',{name:nomeEmpresa,exact:true})).toHaveCount(0)
  // Atribuição administrativa exclusiva da fixture: importação interna não distribui automaticamente.
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
  await page.goto('/empresas/importar');await page.getByLabel('Nome do grupo',{exact:true}).fill('Outra origem da jornada')
  await page.getByLabel('Resumo da lista',{exact:true}).fill('Reimportação das mesmas empresas fictícias')
  await page.getByLabel('Origem dos dados',{exact:true}).fill('Mesmo CSV sintético da jornada')
  await page.getByLabel('Arquivo Excel ou CSV').setInputFiles({name:'reimportacao.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
  await page.getByRole('button',{name:'Conferir arquivo',exact:true}).click();await page.getByRole('button',{name:'Confirmar importação',exact:true}).click()
  await expect(page.getByText('0 empresas novas.',{exact:true})).toBeVisible()
  expect(await comBancoGrupos(async c=>(await c.query("SELECT google_place_id,empresa_id FROM empresa_origem_google WHERE google_place_id LIKE 'place-catalogo-jornada-%' ORDER BY 1")).rows)).toEqual(idsAntes)
 }finally{await contexto.close()}
})
