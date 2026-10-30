import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'
let banco:BancoDeTeste, eu:string, outro:string, gestor:string, empresa:string
beforeAll(async()=>{banco=await criarBancoDeTeste();eu=await criarUsuario(banco,'vendedor','Eu');outro=await criarUsuario(banco,'vendedor','Outro');gestor=await criarUsuario(banco,'gestor','Gestor')})
afterAll(async()=>{await banco?.derrubar()})
beforeEach(async()=>{
  await banco.sql("UPDATE usuario SET ativo=true,senha_provisoria_pendente=false,papel=CASE WHEN id=$1 THEN 'gestor' ELSE 'vendedor' END",[gestor])
  ;[{id:empresa}]=await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Empresa própria','11987654321') RETURNING id")
  await vincularGrupoAtivo(banco,[empresa])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[empresa,eu])
})
async function rpc(comando:string,ator=eu,versao?:number,chave=randomUUID()) {
  const [v]=await banco.sql<{versao:number}>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1',[empresa])
  return banco.comoUsuario(ator,async e=>(await e<{r:{ok:boolean;motivo?:string;versao:number;repetida:boolean}}>(`SELECT ${comando} AS r`,[empresa,chave,versao??v.versao])).linhas[0].r)
}

test.each(['nao_liguei','nao_atendeu','interessado','sem_interesse'])('resultado %s registra autor e deriva efeitos sem desfecho da tela',async tipo=>{
 const comando=`contato_registrar_direto($1,$2,$3,'${tipo}','Nota real',NULL,NULL)`
 expect(await rpc(comando)).toMatchObject({ok:true})
 expect(await banco.sql('SELECT tipo,nota,criado_por FROM contato WHERE empresa_id=$1',[empresa])).toEqual([{tipo,nota:'Nota real',criado_por:eu}])
 expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1',[empresa])).toHaveLength(tipo==='interessado'?1:0)
 expect((await banco.sql<{arquivada_em:Date|null}>('SELECT arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[empresa]))[0].arquivada_em!==null).toBe(tipo==='sem_interesse')
})
test.each(["'inventado',NULL,NULL,NULL","'retornar_depois',NULL,NULL,NULL","'acompanhamento',NULL,NULL,NULL","'interessado',NULL,'incompleto',NULL","'nao_atendeu',NULL,NULL,'2026-01-01'","'nao_atendeu',NULL,'Data inválida','2026-02-30'","'sem_interesse',NULL,'Não agendar','2026-01-01'"])('entrada inválida %s não grava contato ou negociação',async args=>{
 expect(await rpc(`contato_registrar_direto($1,$2,$3,${args})`)).toEqual({ok:false,motivo:'dados_invalidos'})
 for(const tabela of ['contato','negociacao'])expect(await banco.sql(`SELECT id FROM ${tabela} WHERE empresa_id=$1`,[empresa])).toEqual([])
})
test.each(['outro','gestor'])('contato nega %s mesmo com versão conhecida',async ator=>{
 expect(await rpc("contato_registrar_direto($1,$2,$3,'interessado',NULL,NULL,NULL)",ator==='outro'?outro:gestor)).toEqual({ok:false,motivo:'sem_permissao'})
 expect(await banco.sql('SELECT id FROM contato WHERE empresa_id=$1',[empresa])).toEqual([])
})
