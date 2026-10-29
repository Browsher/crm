import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { criteriosVazios } from './lib/google/criterios'
import { prepararArquivamento, conferirComprovante } from '../scripts/google/arquivos.mts'
import type { Associacao, ComprovanteDrive, SolicitacaoDrive } from '../scripts/google/coordenador-tipos.mts'
const hash=(valor:string|Buffer)=>createHash('sha256').update(valor).digest('hex')
async function fixture(){
 const raiz=await mkdtemp(join(tmpdir(),'crm-arquivos-'))
 const associacao:Associacao={contrato:2,vinculo:{motor:'01',executor:randomUUID(),pedido_id:randomUUID(),execucao_id:randomUUID(),vendedor_id:randomUUID(),revisao:1,snapshot_sha256:'a'.repeat(64)}}
 const v=associacao.vinculo
 const exec=join(raiz,'pedidos',v.pedido_id,v.execucao_id)
 const pasta=join(exec,'lotes','01');await mkdir(pasta,{recursive:true})
 const lote_id=randomUUID()
 const candidatas=[{telefone:null,cnpj:null,nome_fantasia:'Loja "A", Brás',google_place_id:'place-A'}]
 const criterios=criteriosVazios()
 const pedido={id:v.pedido_id,vendedor_id:v.vendedor_id,executor:v.executor,execucao_id:v.execucao_id,revisao:1,snapshot_sha256:v.snapshot_sha256,contrato:2,motor:'01',dia:'2026-10-26',nicho:'Brinquedos',bairro:'Brás',cidade:'São Paulo',uf:'SP',criterios}
 await writeFile(join(exec,'pedido.json'),JSON.stringify(pedido))
 const lote=join(pasta,'lote.json');await writeFile(lote,JSON.stringify({lote_id,candidatas}))
 const contexto={pedido_id:v.pedido_id,execucao_id:v.execucao_id,lote_id,revisao:1,snapshot_sha256:v.snapshot_sha256,criterios}
 const verificacoes={...contexto,verificacoes_requeridas:[],evidencias:[],assinatura:hash(JSON.stringify({contexto,candidatas}))}
 await writeFile(join(pasta,'verificacoes.json'),JSON.stringify(verificacoes,null,2))
 const coleta=join(raiz,'coleta-01');await mkdir(coleta);await writeFile(join(coleta,'pedido.json'),JSON.stringify(pedido))
 const bruto=join(coleta,'bruto_original_full.csv');await writeFile(bruto,'place_id,title\r\nplace-A,Loja A\r\n')
 return {raiz,associacao,pasta,lote,lote_id,bruto}
}
function prova(s:SolicitacaoDrive):ComprovanteDrive{return {associacao:s.associacao,solicitacao_id:s.solicitacao_id,lote_id:s.lote_id,pasta_id:'pasta_google_fixture_123',arquivos:s.arquivos.map((a,i)=>({tipo:a.tipo,nome:a.nome,id:'arquivo_google_fixture_'+i,pasta_id:'pasta_google_fixture_123',bytes:a.bytes,sha256:a.sha256,downloadConferido:true}))}}

test('original do lote conserva nove colunas BOM CRLF aspas e hashes dos arquivos reais',async()=>{
 const f=await fixture()
 try{
  const s=await prepararArquivamento(f.associacao,f.lote,[f.bruto])
  const original=s.arquivos.find(a=>a.tipo==='original')!
  const bytes=await readFile(original.caminho)
  expect(bytes.subarray(0,3)).toEqual(Buffer.from([239,187,191]))
  expect(bytes.toString('utf8')).toBe('\ufeff"telefone","cnpj","razao_social","nome_fantasia","contato_nome","email","cep","cnae_principal","google_place_id"\r\n"","","","Loja ""A"", Brás","","","","","place-A"\r\n')
  expect(original.sha256).toBe(hash(bytes));expect(original.bytes).toBe(bytes.length)
  expect(s.arquivos.map(a=>a.tipo)).toEqual(['original','resultado','bruto'])
  expect(s.lote_id).toBe(f.lote_id)
  expect(await prepararArquivamento(f.associacao,f.lote,[f.bruto])).toEqual(s)
  expect(conferirComprovante(s,prova(s))).toEqual(prova(s))
 }finally{await rm(f.raiz,{recursive:true,force:true})}
})
test.each(['solicitacao','vinculo','lote','nome','pasta','hash','bytes','id','ausente','extra'])('comprovante %s divergente nao libera entrega',async campo=>{
 const f=await fixture()
 try{
  const s=await prepararArquivamento(f.associacao,f.lote,[f.bruto]);const p=prova(s)
  if(campo==='solicitacao')p.solicitacao_id=randomUUID()
  if(campo==='vinculo'&&p.associacao.contrato===2)p.associacao={contrato:2,vinculo:{...p.associacao.vinculo,pedido_id:randomUUID()}}
  if(campo==='lote')p.lote_id=randomUUID()
  if(campo==='nome')p.arquivos[0].nome='outro.csv'
  if(campo==='pasta')p.arquivos[0].pasta_id='outra_pasta_123'
  if(campo==='hash')p.arquivos[0].sha256='b'.repeat(64)
  if(campo==='bytes')p.arquivos[0].bytes++
  if(campo==='id')p.arquivos[1].id=p.arquivos[0].id
  if(campo==='ausente')p.arquivos.pop()
  if(campo==='extra')p.arquivos.push({...p.arquivos[0],id:'outro_arquivo_123'})
  expect(()=>conferirComprovante(s,p)).toThrow()
 }finally{await rm(f.raiz,{recursive:true,force:true})}
})
test('coleta sem novidades arquiva o bruto sem gerar lote vazio',async()=>{
 const f=await fixture()
 try{
  const s=await prepararArquivamento(f.associacao,null,[f.bruto])
  expect(s.lote_id).toBeNull()
  expect(s.arquivos.map(a=>a.tipo)).toEqual(['bruto'])
  expect(conferirComprovante(s,prova(s)).arquivos[0].sha256).toBe(hash(await readFile(f.bruto)))
 }finally{await rm(f.raiz,{recursive:true,force:true})}
})
test('originais ou verificacoes alterados nao substituem intencao de arquivamento',async()=>{
 const f=await fixture()
 try{
  await prepararArquivamento(f.associacao,f.lote,[f.bruto])
  await writeFile(join(f.pasta,'verificacoes.json'),'{}')
  await expect(prepararArquivamento(f.associacao,f.lote,[f.bruto])).rejects.toThrow()
 }finally{await rm(f.raiz,{recursive:true,force:true})}
})