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

test('iniciar não cria reserva, contato, negociação nem altera o responsável',async()=>{
 expect(await rpc(iniciar)).toMatchObject({ok:true})
 for(const tabela of ['empresa_fila','contato','negociacao']) expect(await banco.sql(`SELECT empresa_id FROM ${tabela} WHERE empresa_id=$1`,[empresa])).toEqual([])
 expect(await banco.sql('SELECT vendedor_id,iniciada_em FROM empresa_vinculo WHERE empresa_id=$1',[empresa])).toEqual([{vendedor_id:eu,iniciada_em:expect.any(Date)}])
})
test.each([-90,0,90])('entrega de %s dias não expira nem exige aquisição paga',async dias=>{
 await banco.sql("UPDATE empresa_vinculo SET recebida_em=now()+($2::text||' days')::interval WHERE empresa_id=$1",[empresa,dias])
 expect(await rpc(iniciar)).toMatchObject({ok:true})
 expect((await banco.comoUsuario(eu,e=>e('SELECT id FROM empresa WHERE id=$1',[empresa]))).linhas).toEqual([{id:empresa}])
})
test('inatividade não redistribui a empresa ao próximo vendedor',async()=>{
 await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[eu])
 expect(await rpc(iniciar,outro)).toEqual({ok:false,motivo:'sem_permissao'})
 expect(await banco.sql('SELECT vendedor_id FROM empresa_vinculo WHERE empresa_id=$1',[empresa])).toEqual([{vendedor_id:eu}])
})
test('gestor não ganha aquisição nem escrita comercial',async()=>{expect(await rpc(iniciar,gestor)).toEqual({ok:false,motivo:'sem_permissao'})})
