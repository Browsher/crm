import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { setTimeout as aguardar } from 'node:timers/promises'
import { mkdir, open, readFile, realpath, rename, stat, lstat } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type { Journal, MedicaoRam } from './coordenador-tipos.mts'
const executar=promisify(execFile)
const objeto=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v)
const chaves=(v:Record<string,unknown>,campos:string[])=>Object.keys(v).sort().join(',')===[...campos].sort().join(',')
const erroJournal=()=>new Error('Journal divergente. Preserve o estado para reconciliação.')
export type ConsultaProcesso={ok:true;processo:{pid:number;inicio:string}|null}|{ok:false}

export function admitirOnda(m:MedicaoRam):{ok:true}|{ok:false;motivo:'ram_insuficiente'|'medicao_indisponivel'} {
  if(!m.ok||!Number.isFinite(m.disponivelMiB)||m.disponivelMiB<0)return {ok:false,motivo:'medicao_indisponivel'}
  return m.disponivelMiB>=5632?{ok:true}:{ok:false,motivo:'ram_insuficiente'}
}
export function aplicarMedicao(j:Journal,m:MedicaoRam):Journal {
  return {...j,admissaoSuspensa:j.admissaoSuspensa||!m.ok||!Number.isFinite(m.disponivelMiB)||m.disponivelMiB<512}
}
function validarJournal(valor:unknown,pasta:string):asserts valor is Journal {
  if(!objeto(valor)||!chaves(valor,['versao','ciclo_id','dono','posicoes','admissaoSuspensa'])||valor.versao!==1||!uuid(valor.ciclo_id)||typeof valor.admissaoSuspensa!=='boolean'||!objeto(valor.dono)||!chaves(valor.dono,['pid','inicio'])||!Number.isSafeInteger(valor.dono.pid)||Number(valor.dono.pid)<1||typeof valor.dono.inicio!=='string'||!/^[a-z0-9:.+_-]{1,128}$/i.test(valor.dono.inicio)||!Array.isArray(valor.posicoes)||valor.posicoes.length!==3)throw erroJournal()
  const motores=new Set<string>()
  for(const p of valor.posicoes){
    if(!objeto(p)||!chaves(p,['motor','associacao','etapa','contexto','lote','coleta','motivo'])||!['01','02','03'].includes(String(p.motor))||motores.has(String(p.motor))||!['retomar','coletar','selecionar','reservar','verificar','arquivar','entregar','concluir','pendente','concluido'].includes(String(p.etapa))||!Number.isSafeInteger(p.coleta)||Number(p.coleta)<0||Number(p.coleta)>3||(p.motivo!==null&&(typeof p.motivo!=='string'||!/^[a-z0-9_]{1,80}$/.test(p.motivo))))throw erroJournal()
    motores.add(String(p.motor))
    for(const k of ['contexto','lote'])if(p[k]!==null){
      if(typeof p[k]!=='string'||!isAbsolute(p[k])||/[\x00-\x1f\x7f]/.test(p[k] as string))throw erroJournal()
      const caminho=relative(resolve(pasta),resolve(p[k] as string))
      if(!caminho||caminho==='..'||caminho.startsWith('..'+sep)||isAbsolute(caminho))throw erroJournal()
    }
    if(p.associacao===null)continue
    const a=p.associacao
    if(!objeto(a)||!chaves(a,['contrato','vinculo'])||!objeto(a.vinculo))throw erroJournal()
    const v=a.vinculo
    const comuns=['motor','executor','pedido_id','vendedor_id']
    if(v.motor!==p.motor||![v.executor,v.pedido_id,v.vendedor_id].every(uuid))throw erroJournal()
    if(a.contrato===1){if(p.motor!=='01'||p.lote!==null||!chaves(v,comuns))throw erroJournal()}
    else if(a.contrato===2){if(!chaves(v,[...comuns,'execucao_id','revisao','snapshot_sha256'])||!uuid(v.execucao_id)||!Number.isSafeInteger(v.revisao)||Number(v.revisao)<1||typeof v.snapshot_sha256!=='string'||!/^[0-9a-f]{64}$/.test(v.snapshot_sha256))throw erroJournal()}
    else throw erroJournal()
  }
}
export async function confinarCaminho(pasta:string,caminho:string):Promise<string>{
  const raiz=await realpath(resolve(pasta))
  const alvo=resolve(caminho)
  const rel=relative(resolve(pasta),alvo)
  if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw erroJournal()
  let existente=alvo
  let real:string
  while(true){
    try{real=await realpath(existente);break}catch(e){
      if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e
      try{if((await lstat(existente)).isSymbolicLink())throw erroJournal()}catch(metaErro){if((metaErro as NodeJS.ErrnoException).code!=='ENOENT')throw metaErro}
      const pai=dirname(existente);if(pai===existente)throw erroJournal();existente=pai
    }
  }
  const realRel=relative(raiz,real)
  if(realRel==='..'||realRel.startsWith('..'+sep)||isAbsolute(realRel))throw erroJournal()
  return alvo
}
async function conferirCaminhos(j:Journal,pasta:string){for(const p of j.posicoes)for(const caminho of [p.contexto,p.lote])if(caminho)await confinarCaminho(pasta,caminho)}
export async function lerJournal(pasta:string):Promise<Journal|null>{
  try{
    const arquivo=resolve(pasta,'coordenador','journal.json')
    await confinarCaminho(pasta,arquivo)
    if((await stat(arquivo)).size>65536)throw erroJournal()
    const valor:unknown=JSON.parse(await readFile(arquivo,'utf8'))
    validarJournal(valor,pasta)
    await conferirCaminhos(valor,pasta)
    return valor
  }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw erroJournal()}
}
export async function salvarJournal(pasta:string,journal:Journal):Promise<void>{
  validarJournal(journal,pasta)
  const dir=resolve(pasta,'coordenador')
  await mkdir(pasta,{recursive:true})
  await confinarCaminho(pasta,dir)
  await mkdir(dir,{recursive:true})
  await conferirCaminhos(journal,pasta)
  const destino=resolve(dir,'journal.json')
  await confinarCaminho(pasta,destino)
  const temporario=destino+'.tmp-'+randomUUID()
  const arquivo=await open(temporario,'wx',0o600)
  try{await arquivo.writeFile(JSON.stringify(journal,null,2),'utf8');await arquivo.sync()}finally{await arquivo.close()}
  // Windows readers may briefly deny replacement while still sharing reads/writes.
  // Keep the old journal intact and retry only the same atomic rename, with a bound.
  for(let tentativa=0;;tentativa++){
    try{await rename(temporario,destino);break}catch(e){
      const codigo=(e as NodeJS.ErrnoException).code
      if(process.platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(codigo??'')||tentativa>=30)throw e
      await aguardar(100)
    }
  }
}
async function probe(acao:string,pid?:number):Promise<unknown>{
  const args=['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./host.ps1',import.meta.url)),'-Acao',acao]
  if(pid!==undefined)args.push('-PidAlvo',String(pid))
  const {stdout}=await executar('powershell.exe',args,{encoding:'utf8',timeout:15000,windowsHide:true})
  return JSON.parse(stdout)
}
export async function medirRam():Promise<MedicaoRam>{
  try{
    if(process.platform!=='win32')throw new Error('Plataforma sem probe Windows')
    const r=await probe('Memoria')
    if(!objeto(r)||r.ok!==true||typeof r.disponivelMiB!=='number'||!Number.isFinite(r.disponivelMiB)||r.disponivelMiB<0||typeof r.instante!=='string'||!Number.isFinite(Date.parse(r.instante)))throw new Error('Probe inválido')
    return {ok:true,disponivelMiB:r.disponivelMiB,instante:r.instante}
  }catch{return {ok:false,motivo:'medicao_indisponivel'}}
}
export async function inspecionarProcesso(pid:number):Promise<ConsultaProcesso>{
  if(!Number.isSafeInteger(pid)||pid<1)return {ok:false}
  try{
    if(process.platform==='win32'){
      const r=await probe('Processo',pid)
      if(!objeto(r)||r.ok!==true)return {ok:false}
      if(r.processo===null)return {ok:true,processo:null}
      if(!objeto(r.processo)||r.processo.pid!==pid||typeof r.processo.inicio!=='string')return {ok:false}
      return {ok:true,processo:{pid,inicio:r.processo.inicio}}
    }
    const texto=await readFile('/proc/'+pid+'/stat','utf8')
    const inicio=texto.slice(texto.lastIndexOf(')')+2).split(' ')[19]
    const boot=(await readFile('/proc/sys/kernel/random/boot_id','utf8')).trim()
    if(!/^\d+$/.test(inicio)||!/^[a-f0-9-]+$/.test(boot))return {ok:false}
    return {ok:true,processo:{pid,inicio:boot+':'+inicio}}
  }catch(e){return (e as NodeJS.ErrnoException).code==='ENOENT'?{ok:true,processo:null}:{ok:false}}
}
export async function obterExclusao(pasta:string,opcoes:{porta?:number;inspecionar?:(pid:number)=>Promise<ConsultaProcesso>}={}):Promise<{liberar():Promise<void>;porta:number}>{
  const servidor=createServer(socket=>socket.destroy())
  await new Promise<void>((aceitar,recusar)=>{servidor.once('error',()=>recusar(new Error('Outro coordenador ou aplicativo usa a exclusão local. Preserve as pendências.')));servidor.listen({host:'127.0.0.1',port:opcoes.porta??8096,exclusive:true},aceitar)})
  const liberar=()=>new Promise<void>((aceitar,recusar)=>servidor.close(e=>e?recusar(e):aceitar()))
  try{
    const anterior=await lerJournal(pasta)
    if(anterior){
      const dono=await (opcoes.inspecionar??inspecionarProcesso)(anterior.dono.pid)
      if(!dono.ok||(dono.processo&&dono.processo.inicio===anterior.dono.inicio))throw new Error('Processo anterior vivo ou não confirmado. Aguarde e preserve o journal.')
    }
    return {liberar,porta:(servidor.address() as {port:number}).port}
  }catch(e){await liberar();throw e}
}