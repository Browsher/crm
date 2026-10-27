import { randomUUID } from 'node:crypto'
import type { QueryResultRow } from 'pg'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outro: string
const filtros = { palavra: 'Armarinhos', cnae: '', uf: 'SP', cidade: 'São Paulo', bairro: 'Brás', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 3, offset: 0 }
const empresa = { cnpj: '11222333000181', razao_social: 'Armarinhos fictício LTDA', nome_fantasia: null, email: 'loja@exemplo.test', telefone: '11988887777', cep: null, cnae_principal: '4755502', situacao: 'ATIVA', porte: 'ME', data_abertura: '2020-01-15', logradouro: 'Rua fictícia', numero: '10', complemento: null, bairro: 'Brás', cidade: 'São Paulo', uf: 'SP', telefones: ['11988887777'] }
const segunda = { ...empresa, cnpj: '99887766000105', razao_social: 'Segunda fictícia LTDA', telefone: '11977776666', telefones: ['11977776666'], email: 'segunda@exemplo.test' }
const call = <T extends QueryResultRow = QueryResultRow>(u: string, sql: string, params: unknown[] = []) => banco.comoUsuario(u, e => e<T>(sql, params)).then(r => r.linhas)
const reservar = (id: string, legado = false, u = vendedor) => call(u, `SELECT ${legado ? 'busca_empresa_reservar' : 'busca_empresa_reservar_casa'}($1,$2,$3) resultado`, [id, 'Armarinhos Brás', JSON.stringify(filtros)])
const concluir = (id: string, empresas: unknown[] = [empresa]) => call(vendedor, 'SELECT busca_empresa_concluir($1,$2,NULL)', [id, JSON.stringify(empresas)])
const importar = (id: string, cnpjs = [empresa.cnpj]) => call<{ grupo_id: string; inseridas: number; vinculadas: number }>(vendedor, 'SELECT * FROM busca_empresa_importar($1,$2)', [id, cnpjs])

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'CasaGestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'CasaVendedor')
  outro = await criarUsuario(banco, 'vendedor', 'CasaOutro')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM busca_empresa')
  await banco.sql('DELETE FROM busca_empresa_limite')
  await banco.sql('DELETE FROM empresa_dados_cadastrais')
  await banco.sql('DELETE FROM grupo_importacao_empresa')
  await banco.sql('DELETE FROM grupo_importacao')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
  for (const id of [vendedor, outro]) await call(gestor, 'SELECT busca_empresa_limite_definir($1,20,false)', [id])
})

const automatico=(id:string,u=vendedor)=>call<{grupo_id:string|null;inseridas:number;vinculadas:number}>(u,'SELECT * FROM busca_empresa_importar($1,NULL)',[id])
test('inclui válidas automaticamente, exclui telefone ausente/repetido e repete no mesmo grupo',async()=>{
 const id=randomUUID();await reservar(id)
 await concluir(id,[empresa,{...segunda,telefone:empresa.telefone,telefones:[empresa.telefone]},{...segunda,cnpj:'11222333000343',telefone:null,telefones:[]}])
 const [r]=await automatico(id);expect(r).toMatchObject({inseridas:1,vinculadas:1});expect(r.grupo_id).toBeTruthy()
 expect((await automatico(id))[0]).toEqual({...r,inseridas:0})
 expect(await banco.sql('SELECT count(*)::int n FROM grupo_importacao')).toEqual([{n:1}])
})
test('rechecagem concorrente pula contato repetido, preserva resultados e não cria grupo vazio',async()=>{
 const a=randomUUID(),b=randomUUID();await reservar(a);await reservar(b)
 await concluir(a);await concluir(b,[{...segunda,telefone:empresa.telefone,telefones:[empresa.telefone]}])
 const rs=await Promise.all([automatico(a),automatico(b)])
 expect(rs.map(r=>r[0].inseridas).sort()).toEqual([0,1])
 expect(await banco.sql('SELECT count(*)::int n FROM empresa')).toEqual([{n:1}])
 expect(await banco.sql('SELECT count(*)::int n FROM grupo_importacao')).toEqual([{n:1}])
 expect(await banco.sql("SELECT count(*)::int n FROM busca_empresa WHERE estado='concluida' AND jsonb_array_length(empresas)=1")).toEqual([{n:2}])
})
test('pausa e identidade permanecem no banco; resultados persistem e retomam sem nova reserva',async()=>{
 const id=randomUUID();await reservar(id);await concluir(id)
 await expect(automatico(id,outro)).rejects.toMatchObject({code:'42501'})
 await expect(automatico(id,gestor)).rejects.toMatchObject({code:'42501'})
 await call(gestor,'SELECT busca_empresa_limite_definir($1,20,true)',[vendedor])
 await expect(automatico(id)).rejects.toMatchObject({code:'42501'})
 expect(await banco.sql("SELECT estado,jsonb_array_length(empresas)::int n FROM busca_empresa WHERE id=$1",[id])).toEqual([{estado:'concluida',n:1}])
 await call(gestor,'SELECT busca_empresa_limite_definir($1,20,false)',[vendedor])
 expect((await automatico(id))[0].inseridas).toBe(1)
 expect(await banco.sql('SELECT sum(quantidade)::int n FROM busca_empresa')).toEqual([{n:3}])
})
test('nenhuma candidata válida não cria lista; seleção explícita ainda recusa telefone ausente',async()=>{
 const id=randomUUID();await reservar(id);await concluir(id,[{...empresa,telefone:null,telefones:[]}])
 expect((await automatico(id))[0]).toEqual({grupo_id:null,inseridas:0,vinculadas:0})
 expect(await banco.sql('SELECT count(*)::int n FROM grupo_importacao')).toEqual([{n:0}])
 await expect(importar(id)).rejects.toMatchObject({code:'22023'})
})

test('CNPJ encontrado em duas buscas entra só na primeira lista, com rechecagem persistida',async()=>{
 const a=randomUUID(),b=randomUUID();await reservar(a);await reservar(b);await concluir(a);await concluir(b)
 expect((await automatico(a))[0]).toMatchObject({inseridas:1,vinculadas:1})
 expect((await automatico(b))[0]).toEqual({grupo_id:null,inseridas:0,vinculadas:0})
 expect(await banco.sql("SELECT (empresas->0->>'bloqueada_por_repeticao')::boolean bloqueada FROM busca_empresa WHERE id=$1",[b])).toEqual([{bloqueada:true}])
})

test('completa inclusão histórica parcial no mesmo grupo e registra conclusão automática',async()=>{
 const id=randomUUID();await reservar(id);await concluir(id,[empresa,segunda])
 const [parcial]=await importar(id)
 expect(await banco.sql('SELECT inclusao_automatica_concluida concluida FROM busca_empresa WHERE id=$1',[id])).toEqual([{concluida:false}])
 const [r]=await automatico(id)
 expect(r).toEqual({grupo_id:parcial.grupo_id,inseridas:1,vinculadas:2})
 expect(await banco.sql('SELECT inclusao_automatica_concluida concluida FROM busca_empresa WHERE id=$1',[id])).toEqual([{concluida:true}])
 expect((await automatico(id))[0]).toEqual({...r,inseridas:0})
})
