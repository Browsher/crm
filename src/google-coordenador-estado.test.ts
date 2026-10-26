import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'
import { admitirOnda, aplicarMedicao, lerJournal, salvarJournal, obterExclusao } from '../scripts/google/coordenador-estado.mts'
import type { Journal } from '../scripts/google/coordenador-tipos.mts'
const executar=promisify(execFile)
const journal = (): Journal => ({versao:1,ciclo_id:randomUUID(),dono:{pid:12345,inicio:'inicio-anterior'},admissaoSuspensa:false,posicoes:[
  {motor:'01',associacao:null,etapa:'retomar',contexto:null,lote:null,coleta:0,motivo:null},
  {motor:'02',associacao:null,etapa:'retomar',contexto:null,lote:null,coleta:0,motivo:null},
  {motor:'03',associacao:null,etapa:'retomar',contexto:null,lote:null,coleta:0,motivo:null},
]})
async function portaLivre(){ const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as {port:number}).port;await new Promise<void>(r=>s.close(()=>r()));return p }

test('5632 MiB e o limiar sem fallback sequencial',()=>{
 expect(admitirOnda({ok:true,disponivelMiB:5631,instante:'2026-10-26T20:00:00Z'})).toEqual({ok:false,motivo:'ram_insuficiente'})
 expect(admitirOnda({ok:true,disponivelMiB:5632,instante:'2026-10-26T20:00:00Z'})).toEqual({ok:true})
 expect(admitirOnda({ok:false,motivo:'medicao_indisponivel'})).toEqual({ok:false,motivo:'medicao_indisponivel'})
 expect(admitirOnda({ok:true,disponivelMiB:Number.NaN,instante:'2026-10-26T20:00:00Z'}).ok).toBe(false)
})
test('RAM critica suspende admissao sem modificar nenhuma posicao iniciada',()=>{
 const original=journal()
 const novo=aplicarMedicao(original,{ok:true,disponivelMiB:511,instante:'2026-10-26T20:00:00Z'})
 expect(novo.admissaoSuspensa).toBe(true)
 expect(novo.posicoes).toEqual(original.posicoes)
 expect(original.admissaoSuspensa).toBe(false)
 expect(aplicarMedicao(novo,{ok:true,disponivelMiB:9000,instante:'2026-10-26T20:00:00Z'}).admissaoSuspensa).toBe(true)
})
test('journal preserva UUIDs e ignora arquivo temporario incompleto',async()=>{
 const pasta=await mkdtemp(join(tmpdir(),'crm-journal-'))
 try {
  const original=journal()
  await salvarJournal(pasta,original)
  await writeFile(join(pasta,'coordenador','journal.json.tmp-incompleto'),'{')
  expect(await lerJournal(pasta)).toEqual(original)
  await expect(salvarJournal(pasta,{...original,versao:2} as unknown as Journal)).rejects.toThrow()
  expect(await lerJournal(pasta)).toEqual(original)
 } finally {await rm(pasta,{recursive:true,force:true})}
})
test.each(['caminho','motor','segredo','vinculo'])('journal recusa %s divergente sem sobrescrever o ultimo valido',async campo=>{
 const pasta=await mkdtemp(join(tmpdir(),'crm-journal-'))
 try {
  const original=journal();await salvarJournal(pasta,original)
  const ruim=structuredClone(original)
  if(campo==='caminho')ruim.posicoes[0].contexto=resolve(pasta,'..','arquivo-externo.json')
  if(campo==='motor')ruim.posicoes[1].motor='01'
  if(campo==='segredo')Object.assign(ruim,{token:'secreto'})
  if(campo==='vinculo')ruim.posicoes[0].associacao={contrato:2,vinculo:{motor:'03',executor:randomUUID(),pedido_id:randomUUID(),execucao_id:randomUUID(),vendedor_id:randomUUID(),revisao:1,snapshot_sha256:'a'.repeat(64)}}
  await expect(salvarJournal(pasta,ruim)).rejects.toThrow()
  expect(await lerJournal(pasta)).toEqual(original)
 } finally {await rm(pasta,{recursive:true,force:true})}
})

test('duas retomadas disputam exclusao e PID reutilizado nao assume identidade antiga',async()=>{
 const pasta=await mkdtemp(join(tmpdir(),'crm-exclusao-'))
 const porta=await portaLivre()
 try {
  const j=journal();await salvarJournal(pasta,j)
  const opcoes={porta,inspecionar:async()=>({ok:true as const,processo:{pid:j.dono.pid,inicio:'inicio-novo'}})}
  const resultados=await Promise.allSettled([obterExclusao(pasta,opcoes),obterExclusao(pasta,opcoes)])
  expect(resultados.filter(r=>r.status==='fulfilled')).toHaveLength(1)
  expect(await lerJournal(pasta)).toEqual(j)
  for(const r of resultados)if(r.status==='fulfilled')await r.value.liberar()
 } finally {await rm(pasta,{recursive:true,force:true})}
})
test.each(['vivo','incerto'])('dono %s impede retomada mesmo quando o socket ficou livre',async caso=>{
 const pasta=await mkdtemp(join(tmpdir(),'crm-exclusao-'))
 try {
  const j=journal();await salvarJournal(pasta,j)
  const inspecionar=async()=>caso==='vivo'?{ok:true as const,processo:j.dono}:{ok:false as const}
  await expect(obterExclusao(pasta,{porta:await portaLivre(),inspecionar})).rejects.toThrow()
 }finally{await rm(pasta,{recursive:true,force:true})}
})
test('processo concorrente e recusado enquanto o primeiro aguarda comprovante Drive',async()=>{
 const pasta=await mkdtemp(join(tmpdir(),'crm-exclusao-'))
 const porta=await portaLivre()
 const trava=await obterExclusao(pasta,{porta})
 try {
  const modulo=pathToFileURL(resolve('scripts/google/coordenador-estado.mts')).href
  const codigo=`import {obterExclusao} from ${JSON.stringify(modulo)};try{await obterExclusao(${JSON.stringify(pasta)},{porta:${porta}});process.exitCode=7}catch{process.exitCode=9}`
  const filho=spawn(process.execPath,['--import','tsx','--input-type=module','-e',codigo],{stdio:'ignore'})
  const status=await new Promise<number|null>(r=>filho.once('exit',r))
  expect(status).toBe(9)
 }finally{await trava.liberar();await rm(pasta,{recursive:true,force:true})}
},15000)

test('probe Windows mostra apenas RAM e instante, sem nomes ou linha de comando',async()=>{
 if(process.platform!=='win32')return
 const {stdout}=await executar('powershell.exe',['-NoProfile','-File','scripts/google/host.ps1','-Acao','Memoria'])
 const valor=JSON.parse(stdout)
 expect(Object.keys(valor).sort()).toEqual(['disponivelMiB','instante','ok'])
 expect(valor.ok).toBe(true)
 expect(valor.disponivelMiB).toBeGreaterThan(0)
})
test('symlink quebrado nao permite gravar journal com caminho externo',async()=>{
 const pasta=await mkdtemp(join(tmpdir(),'crm-journal-'))
 try{
  await symlink(join(pasta,'..',randomUUID()),join(pasta,'desvio'),process.platform==='win32'?'junction':'dir')
  const j=journal();j.posicoes[0].contexto=join(pasta,'desvio','arquivo.json')
  await expect(salvarJournal(pasta,j)).rejects.toThrow()
 }finally{await rm(pasta,{recursive:true,force:true})}
})