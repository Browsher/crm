import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { bancoInicial } from '@/src/lib/banco-empresas'
let banco: BancoDeTeste, gestor: string, vendedor: string
const base = { palavra: '', cnae: '', uf: '', cidade: '', bairro: '', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 1, offset: 0 }
const novos = { ...bancoInicial(),cnaes:['4755502'],cnaesSecundarios:['4742300'],aberturaUltimosDias:'30',excluirMei:true,meiExclusaoDe:'2025-01-01',excluirSimples:true,simplesExclusaoAte:'2026-01-01' }
const reservar=(id:string,avancados:unknown)=>banco.comoUsuario(vendedor,e=>e('SELECT busca_empresa_reservar_casa($1,$2,$3) r',[id,'Busca de teste',JSON.stringify({...base,avancados})])).then(r=>r.linhas)
beforeAll(async()=>{
 banco=await criarBancoDeTeste();gestor=await criarUsuario(banco,'gestor','FiltrosCasaGestor');vendedor=await criarUsuario(banco,'vendedor','FiltrosCasaVendedor')
 await banco.comoUsuario(gestor,e=>e('SELECT busca_empresa_limite_definir($1,100,false)',[vendedor]))
})
afterAll(async()=>{await banco?.derrubar()})
test('persiste filtros independentes, mantém fornecedor/cota e replay do mesmo UUID',async()=>{
 const id=randomUUID()
 expect(await reservar(id,novos)).toEqual([{r:'ok'}]);expect(await reservar(id,novos)).toEqual([{r:'repetida'}])
 expect(await banco.sql("SELECT fornecedor,quantidade,filtros->'avancados' f FROM busca_empresa WHERE id=$1",[id])).toEqual([{fornecedor:'Casa dos Dados',quantidade:1,f:novos}])
 await expect(reservar(id,{...novos,aberturaUltimosDias:'7'})).rejects.toMatchObject({code:'22023'})
})
test('payload antigo sem opcionais continua igual e não ganha campos novos',async()=>{
 const id=randomUUID(),anterior=bancoInicial();expect(await reservar(id,anterior)).toEqual([{r:'ok'}])
 expect(await banco.sql("SELECT filtros->'avancados' f FROM busca_empresa WHERE id=$1",[id])).toEqual([{f:anterior}])
})
for(const [nome,patch] of Object.entries({diasZero:{aberturaUltimosDias:'0'},diasFracionados:{aberturaUltimosDias:'1.5'},overflow:{aberturaUltimosDias:'2147483648'},diasNumero:{aberturaUltimosDias:30},datasAbsolutas:{aberturaDe:'2026-01-01'},optanteMei:{portes:['MEI']},optanteSimples:{regimes:['Simples Nacional']},dataInvalida:{meiExclusaoDe:'2026-02-30'},periodoInvertido:{meiExclusaoDe:'2026-10-02',meiExclusaoAte:'2026-10-01'},periodoSemExclusao:{excluirSimples:false},flagString:{excluirMei:'true'},cnaeInvalido:{cnaesSecundarios:['12']},cnaeRepetido:{cnaesSecundarios:['4742300','4742300']},atividadeLegada:{atividadeTipo:['principal','secundaria']},chaveDesconhecida:{cpf:'nao-permitido'}})){
 test('banco recusa '+nome+' antes de reservar cota',async()=>{
  const antes=await banco.sql('SELECT count(*)::int n FROM busca_empresa')
  await expect(reservar(randomUUID(),{...novos,...patch})).rejects.toMatchObject({code:'22023'})
  expect(await banco.sql('SELECT count(*)::int n FROM busca_empresa')).toEqual(antes)
 })
}
test('aceita apenas secundário, dias1 e períodos de uma ponta',async()=>{
 expect(await reservar(randomUUID(),{...novos,cnaes:[],aberturaUltimosDias:'1',meiExclusaoDe:'',meiExclusaoAte:'2026-01-01'})).toEqual([{r:'ok'}])
})
