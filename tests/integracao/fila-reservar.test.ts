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

test('dois comandos com mesma versão têm um efeito e conflito explícito',async()=>{
 const r=await Promise.all([rpc(iniciar,eu,1),rpc(iniciar,eu,1)])
 expect(r.filter(x=>x.ok)).toHaveLength(1)
 expect(r.filter(x=>!x.ok)).toEqual([{ok:false,motivo:'desatualizada'}])
 expect(await banco.sql('SELECT empresa_id FROM empresa_fila WHERE empresa_id=$1',[empresa])).toEqual([])
})
test('mesma chave retorna recibo único e uma versão mesmo com duas sessões',async()=>{
 const chave=randomUUID(),r=await Promise.all([rpc(iniciar,eu,1,chave),rpc(iniciar,eu,1,chave)])
 expect(r.every(x=>x.ok)).toBe(true)
 expect(r.map(x=>x.repetida).sort()).toEqual([false,true])
 expect(await banco.sql('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1',[empresa])).toEqual([{versao:2}])
})
test('dois vendedores não adquirem o mesmo vínculo por comando direto',async()=>{
 const r=await Promise.all([rpc(iniciar,eu,1),rpc(iniciar,outro,1)])
 expect(r[0].ok).toBe(true);expect(r[1]).toEqual({ok:false,motivo:'sem_permissao'})
 expect(await banco.sql('SELECT vendedor_id FROM empresa_vinculo WHERE empresa_id=$1',[empresa])).toEqual([{vendedor_id:eu}])
})
test('versão antiga depois de arquivar e retomar não reabre nem apaga estado posterior',async()=>{
 await rpc(iniciar)
 await rpc('empresa_sem_interesse_definir($1,$2,$3,NULL)')
 await rpc('empresa_atendimento_retomar($1,$2,$3)')
 const antes=await banco.sql('SELECT * FROM empresa_vinculo WHERE empresa_id=$1',[empresa])
 expect(await rpc('empresa_sem_interesse_definir($1,$2,$3,NULL)',eu,2)).toEqual({ok:false,motivo:'desatualizada'})
 expect(await banco.sql('SELECT * FROM empresa_vinculo WHERE empresa_id=$1',[empresa])).toEqual(antes)
})
