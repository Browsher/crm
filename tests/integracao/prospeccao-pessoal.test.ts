import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'

let banco: BancoDeTeste
let eu: string
let outro: string
let minha: string
let alheia: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  eu = await criarUsuario(banco, 'vendedor', 'PessoalEu')
  outro = await criarUsuario(banco, 'vendedor', 'PessoalOutro')
  const [{ id }] = await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Minha loja','11988887777') RETURNING id")
  minha = id
  const [outra] = await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Segredo outra loja','11988886666') RETURNING id")
  alheia = outra.id
  for (const [vendedor, empresa, bairro] of [[eu,minha,'Brás'],[outro,alheia,'Segredo bairro']]) {
    const [p] = await banco.sql<{id:string}>("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf) VALUES($1,'2026-10-19','Armarinhos',$2,'São Paulo','SP') RETURNING id",[vendedor,bairro])
    await banco.sql("INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,'{}','entregue',now())",[p.id,empresa])
  }
})
afterAll(async () => { await banco?.derrubar() })

const consultar = (f = {}, usuario = eu) => banco.comoUsuario(usuario, async sql => {
  const r = await sql<{resultado:{empresas:{id:string;origens:string[];situacao:string}[];nichos:string[];bairros:string[];total:number}}>('SELECT prospeccao_pessoal($1) AS resultado',[JSON.stringify(f)])
  return r.linhas[0].resultado
})

test('lista somente empresas entregues ao vendedor, com opções pessoais e sem contatos', async () => {
  const r = await consultar()
  expect(r.empresas.map(e=>e.id)).toEqual([minha])
  expect(r.nichos).toEqual(['Armarinhos'])
  expect(r.bairros).toEqual(['Brás · São Paulo/SP'])
  expect(JSON.stringify(r)).not.toContain('Segredo')
  expect(JSON.stringify(r)).not.toContain('11988887777')
})

test('filtros de origem e nicho são aplicados antes da paginação e não ampliam consulta', async () => {
  expect((await consultar({origem:'banco'})).total).toBe(0)
  expect((await consultar({nicho:'Brinquedos'})).total).toBe(0)
  expect((await consultar({nicho:'Armarinhos',endereco:'Brás · São Paulo/SP'})).total).toBe(1)
  expect((await consultar({nicho:'Brinquedos'})).bairros).toEqual([])
  await expect(consultar({origem:'inventada'})).rejects.toMatchObject({code:'22023'})
})

test('importação própria e Google fazem união sem duplicar e preservam cliente trabalhado', async () => {
  const [g] = await banco.sql<{id:string}>("INSERT INTO grupo_importacao(nome) VALUES('Minha lista') RETURNING id")
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)',[g.id,minha])
  await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,grupo_id) VALUES($1,'Minha lista','{\"palavra\":\"Armarinhos\"}',1,'concluida',$2)",[eu,g.id])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)',[minha,eu])
  await banco.sql('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,100,gen_random_uuid())',[minha,eu])
  const r = await consultar()
  expect(r.total).toBe(1)
  expect(r.empresas[0]).toMatchObject({id:minha,situacao:'cliente',origens:['banco','google']})
  expect((await consultar({},outro)).empresas.map(e=>e.id)).toEqual([alheia])
})

test('aquisição pessoal recusa ID alheio e próxima empresa respeita filtros pessoais',async()=>{
  const [e]=await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Nova pessoal','11977778888') RETURNING id")
  await vincularGrupoAtivo(banco,[e.id])
  const [p]=await banco.sql<{id:string}>("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf) VALUES($1,'2026-10-20','Brinquedos','Sé','São Paulo','SP') RETURNING id",[eu])
  await banco.sql("INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,'{}','entregue',now())",[p.id,e.id])
  const reservar=(alvo:string|null,contexto:string|null,f={})=>banco.comoUsuario(eu,sql=>sql<{resultado:string;empresa_id:string;contexto:string}>('SELECT * FROM prospeccao_pessoal_reservar($1,$2,$3)',[alvo,JSON.stringify(f),contexto])).then(r=>r.linhas[0])
  const r=await reservar(null,null,{nicho:'Brinquedos'})
  expect(r).toMatchObject({resultado:'ok',empresa_id:e.id})
  expect(await reservar(alheia,r.contexto)).toMatchObject({resultado:'indisponivel'})
  expect(await reservar(null,r.contexto,{nicho:'Inexistente'})).toMatchObject({resultado:'sem_candidata'})
  expect(await banco.sql('SELECT reservado_por FROM empresa_fila WHERE empresa_id=$1',[e.id])).toEqual([{reservado_por:eu}])
})

test('nicho e região usam o snapshot da entrega legada mesmo após edição do planejamento',async()=>{
  const [e]=await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Empresa congelada','11955553333') RETURNING id")
  const [p]=await banco.sql<{id:string}>(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,snapshot)
    VALUES($1,'2026-10-21','Plano alterado','Mooca','São Paulo','SP','{"nicho":"Nicho entregue","bairro":"Sé","cidade":"São Paulo","uf":"SP"}') RETURNING id`,[eu])
  await banco.sql("INSERT INTO google_resultado(planejamento_id,indice,empresa_id,dados,situacao,entregue_em) VALUES($1,1,$2,'{}','entregue',now())",[p.id,e.id])
  const r=await consultar({nicho:'Nicho entregue'})
  expect(r.empresas.map(x=>x.id)).toEqual([e.id])
  expect(r.bairros).toEqual(['Sé · São Paulo/SP'])
})
