import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'
let banco:BancoDeTeste,eu:string,outro:string,seq=0
beforeAll(async()=>{banco=await criarBancoDeTeste();eu=await criarUsuario(banco,'vendedor','Consulta');outro=await criarUsuario(banco,'vendedor','Alheio')})
afterAll(async()=>{await banco?.derrubar()})
beforeEach(async()=>{await banco.sql('DELETE FROM empresa_vinculo');await banco.sql('UPDATE usuario SET ativo=true,senha_provisoria_pendente=false')})
async function empresa(nome:string,dono=eu,cnae:string|null=null) {
 const [{id}]=await banco.sql<{id:string}>("INSERT INTO empresa(cnpj,razao_social,telefone,email,cnae_principal) VALUES($1,$2,'11987654321','privado@teste.local',$3) RETURNING id",[String(++seq).padStart(14,'0'),nome,cnae])
 await vincularGrupoAtivo(banco,[id]);await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'banco')",[id,dono])
 return id
}
async function consultar(f:Record<string,string>={},ator=eu){return banco.comoUsuario(ator,async e=>(await e<{r:{empresas:{id:string;nome:string;situacao:string}[];total:number}}>('SELECT prospeccao_pessoal($1) AS r',[f])).linhas[0].r)}

test('grupos compartilhados e importações não viram catálogo público',async()=>{
 const id=await empresa('Compartilhada')
 const [{id:g}]=await banco.sql<{id:string}>("INSERT INTO grupo_importacao(nome) VALUES('Lista interna') RETURNING id")
 await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)',[g,id])
 expect((await consultar()).empresas.map(x=>x.id)).toEqual([id])
 expect((await consultar({},outro)).empresas).toEqual([])
 expect((await banco.comoUsuario(eu,e=>e('SELECT * FROM grupo_importacao'))).linhas).toEqual([])
 expect((await banco.comoUsuario(eu,e=>e('SELECT * FROM grupo_importacao_empresa'))).linhas).toEqual([])
})
test('grupo desativado preserva vínculo e resumo indisponível sem habilitar comando',async()=>{
 const id=await empresa('Origem desativada')
 await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id IN (SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1)',[id])
 expect((await consultar()).empresas).toMatchObject([{id,situacao:'indisponivel'}])
 const r=await banco.comoUsuario(eu,e=>e('SELECT atendimento_iniciar($1,gen_random_uuid(),1) AS r',[id]))
 expect(r.linhas).toEqual([{r:{ok:false,motivo:'desatualizada'}}])
})
test('filtro de nome não entrega resultado de outra lista pessoal',async()=>{
 await empresa('Minha lista');await empresa('Alheia lista',outro)
 expect((await consultar({nome:'Alheia'})).total).toBe(0)
 expect((await consultar({nome:'Minha'})).total).toBe(1)
})
