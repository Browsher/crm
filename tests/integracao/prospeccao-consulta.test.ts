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
async function consultar(f:Record<string,string|undefined>={},ator=eu){return banco.comoUsuario(ator,async e=>(await e<{r:{empresas:{id:string;nome:string;situacao:string}[];total:number}}>('SELECT prospeccao_pessoal($1) AS r',[f])).linhas[0].r)}

test('catálogo pessoal não expõe empresa nem contato alheio',async()=>{
 const propria=await empresa('Minha'),alheia=await empresa('Segredo',outro)
 const r=await consultar()
 expect(r.empresas.map(e=>e.id)).toEqual([propria]);expect(JSON.stringify(r)).not.toMatch(/Segredo|11987654321|privado/)
 expect((await banco.comoUsuario(eu,e=>e('SELECT id FROM empresa WHERE id=$1',[alheia]))).linhas).toEqual([])
})
test.each(['%','_','\\'])('nome trata %s literalmente dentro do conjunto pessoal',async nome=>{
 const id=await empresa('Nome '+nome+' literal');await empresa('Nome comum')
 expect((await consultar({nome})).empresas.map(e=>e.id)).toEqual([id])
})
test('nome normalizado e CNAE combinam AND sem ampliar a consulta',async()=>{
 const id=await empresa('Ação Comércio',eu,'1234567');await empresa('Ação Outra',eu,'7654321');await empresa('Ação Alheia',outro,'1234567')
 expect((await consultar({nome:'ACAO',cnae:'1234567'})).empresas.map(e=>e.id)).toEqual([id])
 expect((await consultar({nome:'ausente',cnae:'1234567'})).total).toBe(0)
})
test('páginas têm 20 itens sem repetição ou vazamento de outra pessoa',async()=>{
 const ids=[];for(let i=0;i<23;i++)ids.push(await empresa('Página '+String(i).padStart(2,'0')))
 await empresa('Página alheia',outro)
 const a=await consultar({pagina:'1'}),b=await consultar({pagina:'2'})
 expect(a.empresas).toHaveLength(20);expect(b.empresas).toHaveLength(3);expect(a.total).toBe(23)
 expect(new Set([...a.empresas,...b.empresas].map(x=>x.id))).toEqual(new Set(ids))
})
test.each([{pagina:'0'},{pagina:'10001'},{cnpj:'abc'},{cnae:'1'},{uf:'sp'},{origem:'inventada'}])('filtro inválido é recusado %j',async f=>{await expect(consultar(f)).rejects.toMatchObject({code:'22023'})})
test('identidade ausente e inativa são negadas antes de filtros',async()=>{
 await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[eu])
 await expect(consultar()).rejects.toMatchObject({code:'42501'})
 await expect(banco.sql("SELECT prospeccao_pessoal('{}')")).rejects.toMatchObject({code:'42501'})
})
