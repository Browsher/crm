import { createReadStream } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, stat } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { normalizarCriterios } from '../../src/lib/google/criterios'
import { conferirRetornoVerificacoes } from '../../src/server/google/verificacoes/cliente'
import { confinarCaminho } from './coordenador-estado.mts'
import type { ArquivoLocal, Associacao, ComprovanteDrive, SolicitacaoDrive } from './coordenador-tipos.mts'
const RAIZ_DRIVE='11bRM44mz5uPfZ-4r3kWH_6OWiGYqg4Wh'
const CAMPOS=['telefone','cnpj','razao_social','nome_fantasia','contato_nome','email','cep','cnae_principal','google_place_id']
const objeto=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const fechado=(v:Record<string,unknown>,campos:string[])=>Object.keys(v).sort().join(',')===[...campos].sort().join(',')
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v)
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex')
const falha=()=>new Error('Arquivos ou comprovante divergentes. Preserve o lote e a intenção.')
export async function lerJson(arquivo:string):Promise<Record<string,unknown>>{
  if((await stat(arquivo)).size>9000000)throw falha()
  const valor:unknown=JSON.parse(await readFile(arquivo,'utf8'))
  if(!objeto(valor))throw falha()
  return valor
}
export async function salvarImutavel(arquivo:string,valor:Buffer|string):Promise<void>{
  const bytes=Buffer.isBuffer(valor)?valor:Buffer.from(valor)
  await mkdir(dirname(arquivo),{recursive:true})
  try{if(!(await readFile(arquivo)).equals(bytes))throw falha();return}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
  const temporario=arquivo+'.tmp-'+randomUUID()
  const h=await open(temporario,'wx',0o600)
  try{await h.writeFile(bytes);await h.sync()}finally{await h.close()}
  await rename(temporario,arquivo)
}
export async function hashArquivo(arquivo:string):Promise<{bytes:number;sha256:string}>{
  if(!(await stat(arquivo)).isFile())throw falha()
  const h=createHash('sha256');let bytes=0
  for await(const b of createReadStream(arquivo)){bytes+=b.length;h.update(b)}
  return {bytes,sha256:h.digest('hex')}
}
function associacaoValida(a:unknown):a is Associacao{
  if(!objeto(a)||!fechado(a,['contrato','vinculo'])||!objeto(a.vinculo))return false
  const v=a.vinculo
  if(!['01','02','03'].includes(String(v.motor))||![v.executor,v.pedido_id,v.vendedor_id].every(uuid))return false
  if(a.contrato===1)return v.motor==='01'&&fechado(v,['motor','executor','pedido_id','vendedor_id'])
  return a.contrato===2&&fechado(v,['motor','executor','pedido_id','execucao_id','vendedor_id','revisao','snapshot_sha256'])&&uuid(v.execucao_id)&&Number.isSafeInteger(v.revisao)&&Number(v.revisao)>0&&typeof v.snapshot_sha256==='string'&&/^[0-9a-f]{64}$/.test(v.snapshot_sha256)
}
export function conferirSolicitacao(valor:unknown):SolicitacaoDrive{
  if(!objeto(valor)||!fechado(valor,['associacao','solicitacao_id','lote_id','pastaPai','pastaNome','arquivos'])||!associacaoValida(valor.associacao)||!uuid(valor.solicitacao_id)||(valor.lote_id!==null&&!uuid(valor.lote_id))||valor.pastaPai!==RAIZ_DRIVE||typeof valor.pastaNome!=='string'||valor.pastaNome.length<1||valor.pastaNome.length>240||/[\x00-\x1f\x7f]/.test(valor.pastaNome)||!Array.isArray(valor.arquivos)||valor.arquivos.length<1||valor.arquivos.length>5)throw falha()
  if(valor.associacao.contrato===1&&valor.lote_id!==null)throw falha()
  const nomes=new Set<string>()
  for(const a of valor.arquivos){
    if(!objeto(a)||!fechado(a,['tipo','caminho','nome','bytes','sha256'])||!['original','resultado','bruto'].includes(String(a.tipo))||typeof a.caminho!=='string'||typeof a.nome!=='string'||!/^[a-z0-9_.-]+$/i.test(a.nome)||nomes.has(a.nome)||!Number.isSafeInteger(a.bytes)||Number(a.bytes)<0||typeof a.sha256!=='string'||!/^[0-9a-f]{64}$/.test(a.sha256))throw falha()
    nomes.add(a.nome)
  }
  return valor as SolicitacaoDrive
}
export function conferirComprovante(s:SolicitacaoDrive,valor:unknown):ComprovanteDrive{
  conferirSolicitacao(s)
  if(!objeto(valor)||!fechado(valor,['associacao','solicitacao_id','lote_id','pasta_id','arquivos'])||!isDeepStrictEqual(valor.associacao,s.associacao)||valor.solicitacao_id!==s.solicitacao_id||valor.lote_id!==s.lote_id||typeof valor.pasta_id!=='string'||!/^[a-z0-9_-]{10,255}$/i.test(valor.pasta_id)||!Array.isArray(valor.arquivos)||valor.arquivos.length!==s.arquivos.length)throw falha()
  const ids=new Set<string>([valor.pasta_id]);const vistos=new Set<string>()
  for(const a of valor.arquivos){
    if(!objeto(a)||!fechado(a,['tipo','nome','id','pasta_id','bytes','sha256','downloadConferido'])||typeof a.id!=='string'||!/^[a-z0-9_-]{10,255}$/i.test(a.id)||ids.has(a.id)||typeof a.nome!=='string'||vistos.has(a.nome)||a.pasta_id!==valor.pasta_id||a.downloadConferido!==true)throw falha()
    const fonte=s.arquivos.find(f=>f.nome===a.nome&&f.tipo===a.tipo)
    if(!fonte||a.bytes!==fonte.bytes||a.sha256!==fonte.sha256)throw falha()
    ids.add(a.id);vistos.add(a.nome)
  }
  return valor as ComprovanteDrive
}
function conferirContexto(p:Record<string,unknown>,a:Associacao){
  const v=a.vinculo
  if(p.id!==v.pedido_id||p.vendedor_id!==v.vendedor_id||(p.executor!==undefined&&p.executor!==v.executor)||(p.motor??'01')!==v.motor||typeof p.dia!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.dia))throw falha()
  if(a.contrato===2&&(p.execucao_id!==a.vinculo.execucao_id||p.revisao!==a.vinculo.revisao||p.snapshot_sha256!==a.vinculo.snapshot_sha256))throw falha()
  for(const k of ['nicho','bairro','cidade','uf'])if(typeof p[k]!=='string'||/[\x00-\x1f\x7f]/.test(p[k] as string))throw falha()
}
export async function prepararArquivamento(associacao:Associacao,lote:string|null,brutos:string[]):Promise<SolicitacaoDrive>{
  if(!associacaoValida(associacao)||brutos.length<1||brutos.length>3)throw falha()
  const pasta=lote?dirname(resolve(lote)):dirname(resolve(brutos[brutos.length-1]))
  const contextoPath=lote?resolve(pasta,'..','..','pedido.json'):resolve(pasta,'pedido.json')
  const pedido=await lerJson(contextoPath)
  conferirContexto(pedido,associacao)
  const arquivos:ArquivoLocal[]=[]
  let loteId:string|null=null
  const adicionar=async(tipo:ArquivoLocal['tipo'],caminho:string,nome:string)=>{arquivos.push({tipo,caminho,nome,...await hashArquivo(caminho)})}
  if(lote){
    if(associacao.contrato!==2)throw falha()
    await confinarCaminho(resolve(pasta,'..','..'),lote)
    const dados=await lerJson(lote)
    if(!uuid(dados.lote_id)||!Array.isArray(dados.candidatas)||dados.candidatas.length<1||dados.candidatas.length>50||!dados.candidatas.every(objeto))throw falha()
    loteId=dados.lote_id as string
    const candidatas=dados.candidatas as Record<string,unknown>[]
    const c=normalizarCriterios((objeto(pedido.snapshot)?pedido.snapshot.criterios:pedido.criterios)??{})
    if(!c.ok)throw falha()
    const v=associacao.vinculo
    const contexto={pedido_id:v.pedido_id,execucao_id:v.execucao_id,lote_id:loteId,revisao:v.revisao,snapshot_sha256:v.snapshot_sha256,criterios:c.valor}
    const resultado=resolve(pasta,'verificacoes.json')
    await confinarCaminho(resolve(pasta,'..','..'),resultado)
    const verificacoes=await lerJson(resultado)
    if(verificacoes.assinatura!==hash(JSON.stringify({contexto,candidatas})))throw falha()
    conferirRetornoVerificacoes(contexto,candidatas,verificacoes)
    const csv='\ufeff'+[CAMPOS,...candidatas.map(c=>CAMPOS.map(k=>{
      const valor=c[k];if(valor!==null&&valor!==undefined&&typeof valor!=='string')throw falha();return valor??''
    }))].map(linha=>linha.map(c=>'"'+c.replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n'
    const original=resolve(pasta,'original.csv')
    await confinarCaminho(resolve(pasta,'..','..'),original)
    await salvarImutavel(original,csv)
    await adicionar('original',original,'lote-'+loteId+'-original.csv')
    await adicionar('resultado',resultado,'lote-'+loteId+'-verificacoes.json')
  } else if(associacao.contrato===1){
    const original=resolve(pasta,'original.csv'),final=resolve(pasta,'final.csv')
    await adicionar('original',original,'legado-original.csv')
    await adicionar('resultado',final,'legado-final.csv')
  }
  for(const [i,bruto] of brutos.entries()){
    if(basename(bruto)!=='bruto_original_full.csv')throw falha()
    const p=await lerJson(resolve(dirname(bruto),'pedido.json'))
    conferirContexto(p,associacao)
    await adicionar('bruto',resolve(bruto),'coleta-'+String(i+1).padStart(2,'0')+'-bruto.csv')
  }
  const intencao=resolve(pasta,lote?'solicitacao-drive.json':'solicitacao-drive-brutos.json')
  let anterior:Record<string,unknown>|null=null
  try{anterior=await lerJson(intencao)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
  const resumo=String(pedido.nicho).slice(0,30)+' · '+String(pedido.bairro||'Cidade inteira').slice(0,30)+' · '+String(pedido.cidade).slice(0,30)+'/'+String(pedido.uf)
  const s=conferirSolicitacao({associacao,solicitacao_id:anterior?.solicitacao_id??randomUUID(),lote_id:loteId,pastaPai:RAIZ_DRIVE,pastaNome:pedido.dia+' · '+associacao.vinculo.vendedor_id.slice(0,8)+' · '+resumo+' · '+associacao.vinculo.pedido_id,arquivos})
  if(anterior&&!isDeepStrictEqual(anterior,s))throw falha()
  if(!anterior)await salvarImutavel(intencao,JSON.stringify(s,null,2))
  return s
}