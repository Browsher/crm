import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
let banco:BancoDeTeste,eu:string,outro:string
let consultaNova:string
const cnpj=(n:number)=>String(83000000000000+n)
const empresa=(n:number,nome=`Encontrada ${n}`)=>({cnpj:cnpj(n),razao_social:nome,nome_fantasia:null,bairro:'Brás',cidade:'São Paulo',uf:'SP',porte:'ME',data_abertura:'2020-01-01',telefone:'11987654321',email:'protegido@teste.local',detalhes:{socios:[{nome:'Sócio',cnpj_cpf_socio:'SEGREDO-DOCUMENTO'}]}})
beforeAll(async()=>{
 banco=await criarBancoDeTeste();eu=await criarUsuario(banco,'vendedor','UltimasEu');outro=await criarUsuario(banco,'vendedor','UltimasOutro')
 await banco.sql(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas,criado_em) VALUES($1,'Antiga',jsonb_build_object('palavra','Armarinhos'),13,'concluida',$2,'2026-10-01T12:00Z')`,[eu,JSON.stringify(Array.from({length:13},(_,i)=>empresa(i+1)))])
 const [r]=await banco.sql<{id:string}>(`INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas,criado_em) VALUES($1,'Empresas · Brasil','{}',2,'concluida',$2,'2026-10-27T12:00Z') RETURNING id`,[eu,JSON.stringify([empresa(5,'Snapshot recente'),empresa(14)])]);consultaNova=r.id
 for(const [dono,estado,nome,n] of [[outro,'concluida','ALHEIA',99],[eu,'falhou','FALHOU',98],[eu,'reservada','PENDENTE',97]] as const)await banco.sql('INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,empresas) VALUES($1,$2,$3,1,$4,$5)',[dono,nome,'{}',estado,JSON.stringify([empresa(n,nome)])])
 const [e]=await banco.sql<{id:string}>('INSERT INTO empresa(cnpj,razao_social,telefone) VALUES($1,$2,$3) RETURNING id',[cnpj(5),'Nome manual preservado','11987654321'])
 await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)',[e.id,eu])
 await banco.sql('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,100,gen_random_uuid())',[e.id,eu])
})
afterAll(async()=>{await banco?.derrubar()})
async function ler(usuario=eu){const anterior=process.env.DATABASE_URL;process.env.DATABASE_URL=banco.urlApp;try{return await repositorioBusca(usuario).empresasRecentes()}finally{process.env.DATABASE_URL=anterior}}
test('inclui resultados sem grupo/importação, deduplica por consulta mais recente e limita11',async()=>{
 const r=await ler();expect(r).toHaveLength(11)
 expect(r.map(e=>e.cnpj)).toEqual([5,14,1,2,3,4,6,7,8,9,10].map(cnpj))
 expect(r[0]).toMatchObject({buscaId:consultaNova,nome:'Snapshot recente',grupoOrigem:'Empresas · Brasil',situacao:'cliente'})
 const [g]=await banco.sql<{n:number}>('SELECT count(*)::int n FROM grupo_importacao');expect(g.n).toBe(0)
})
test('RLS e whitelist não enviam resultados alheios, contatos ou documentos',async()=>{
 const r=JSON.stringify(await ler());for(const segredo of ['ALHEIA','FALHOU','PENDENTE','11987654321','protegido@teste.local','SEGREDO-DOCUMENTO'])expect(r).not.toContain(segredo)
 expect((await ler(outro)).map(e=>e.cnpj)).toEqual([cnpj(99)])
})
