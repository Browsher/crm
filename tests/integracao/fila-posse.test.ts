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
const iniciar='atendimento_iniciar($1,$2,$3)'

test('interesse assume comercialmente sem tirar vínculo; arquivo conserva posse e história',async()=>{
 expect(await rpc("contato_registrar_direto($1,$2,$3,'interessado','Conversa',NULL,NULL)")).toMatchObject({ok:true})
 expect(await rpc('empresa_sem_interesse_definir($1,$2,$3,NULL)')).toMatchObject({ok:true})
 expect(await banco.sql('SELECT vendedor_id,elegivel_em FROM empresa_fila WHERE empresa_id=$1',[empresa])).toEqual([{vendedor_id:eu,elegivel_em:null}])
 expect(await banco.sql('SELECT encerramento FROM negociacao WHERE empresa_id=$1',[empresa])).toEqual([{encerramento:'sem_interesse'}])
 expect(await banco.sql('SELECT nota,criado_por FROM contato WHERE empresa_id=$1',[empresa])).toEqual([{nota:'Conversa',criado_por:eu}])
 expect(await rpc(iniciar,outro)).toEqual({ok:false,motivo:'sem_permissao'})
})
test('retomar arquivo não restaura agenda nem negociação cancelada',async()=>{
 await rpc("contato_registrar_direto($1,$2,$3,'retornar_depois',NULL,'Ligar','2020-01-01')")
 await rpc('empresa_sem_interesse_definir($1,$2,$3,NULL)')
 expect(await rpc('empresa_atendimento_retomar($1,$2,$3)')).toMatchObject({ok:true})
 expect(await banco.sql('SELECT agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[empresa])).toEqual([{agenda_contato_id:null,arquivada_em:null}])
 expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL',[empresa])).toEqual([])
 expect(await banco.sql('SELECT proximo_passo FROM contato WHERE empresa_id=$1',[empresa])).toEqual([{proximo_passo:'Ligar'}])
})
test.each(['outro','gestor','pendente','inativo'])('arquivar recusa %s sem qualquer efeito',async tipo=>{
 const ator=tipo==='outro'?outro:tipo==='gestor'?gestor:eu
 if(tipo==='pendente')await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[eu])
 if(tipo==='inativo')await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[eu])
 expect(await rpc('empresa_sem_interesse_definir($1,$2,$3,NULL)',ator)).toEqual({ok:false,motivo:'sem_permissao'})
 expect(await banco.sql('SELECT arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[empresa])).toEqual([{arquivada_em:null}])
})
