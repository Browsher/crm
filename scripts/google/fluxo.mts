import { mkdir, stat, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { ProgressoGoogle } from '../../src/lib/google/progresso'
import { conferirComprovante, prepararArquivamento, hashArquivo, lerJson, salvarImutavel } from './arquivos.mts'
import { confinarCaminho } from './coordenador-estado.mts'
import type { DependenciasFluxo, EtapaLocal, Posicao } from './coordenador-tipos.mts'
const objeto=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const motivos=['meta_atingida','limite_lotes','sem_novidades','sem_resultados']
const falha=()=>new Error('Etapa não confirmada. Preserve o contexto e os arquivos.')
const existe=async(p:string)=>{try{await stat(p);return true}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e}}
const ultimaLinha=(s:string)=>s.trim().split(/\r?\n/).at(-1)??''

export async function executarPedido(inicial:Posicao,deps:DependenciasFluxo):Promise<Posicao>{
  let p=structuredClone(inicial)
  const persistir=async(etapa:EtapaLocal,campos:Partial<Posicao>={})=>{p={...p,...campos,etapa};await deps.persistir(structuredClone(p))}
  const cli=(acao:string,opcoes:string[]=[])=>deps.comando('node',['--import','tsx','scripts/google/agente.mts',acao,...opcoes,'--pasta',deps.pastaEstado])
  const python=(arquivo:string,acao:string,args:string[])=>deps.comando('python',['-X','utf8','-B','scripts/google/'+arquivo,acao,...args])
  try{
    const a=p.associacao
    if(!a||!p.contexto||a.vinculo.motor!==p.motor)throw falha()
    const v=a.vinculo
    await confinarCaminho(deps.pastaEstado,p.contexto)
    const contexto=await lerJson(p.contexto)
    const executor=await lerJson(resolve(deps.pastaEstado,'executor.json'))
    if(executor.id!==v.executor||contexto.id!==v.pedido_id||contexto.vendedor_id!==v.vendedor_id||(contexto.motor??'01')!==p.motor)throw falha()
    if(a.contrato===2&&(contexto.execucao_id!==a.vinculo.execucao_id||contexto.revisao!==a.vinculo.revisao||contexto.snapshot_sha256!==a.vinculo.snapshot_sha256))throw falha()
    const base=resolve(deps.pastaEstado,'pedidos',v.pedido_id,a.contrato===2?a.vinculo.execucao_id:'legado')
    const contextoLocal=resolve(base,'pedido.json')
    await salvarImutavel(contextoLocal,JSON.stringify({...contexto,motor:p.motor,estado:'coletando'},null,2))
    await persistir(p.etapa,{contexto:contextoLocal})
    const consultar=async():Promise<ProgressoGoogle>=>{
      const r:unknown=JSON.parse(await cli('consultar',['--pedido',v.pedido_id]))
      if(!objeto(r)||!objeto(r.execucao))throw falha()
      const e=r.execucao
      if(e.pedido_id!==v.pedido_id||e.executor_id!==v.executor||e.vendedor_id!==v.vendedor_id||e.contrato!==a.contrato||!Array.isArray(e.vistas)||!e.vistas.every(i=>typeof i==='string')||!Array.isArray(e.lotes_confirmados)||!Number.isSafeInteger(e.analisadas)||Number(e.analisadas)<0||Number(e.analisadas)>150||!Number.isSafeInteger(e.entregues)||Number(e.entregues)<0||Number(e.entregues)>50||!Number.isSafeInteger(e.lotes)||Number(e.lotes)<0||Number(e.lotes)>3)throw falha()
      if(a.contrato===2&&(e.execucao_id!==a.vinculo.execucao_id||e.revisao!==a.vinculo.revisao||e.snapshot_sha256!==a.vinculo.snapshot_sha256))throw falha()
      return e as ProgressoGoogle
    }
    if(p.etapa==='pendente'){
      const anterior=p.motivo?.replace(/_pendente$/,'')
      const etapas=['retomar','coletar','selecionar','reservar','verificar','arquivar','entregar','concluir']
      await persistir(etapas.includes(anterior??'')?anterior as EtapaLocal:'retomar',{motivo:null})
    }
    if(a.contrato===1){
      const estado=await consultar()
      if(estado.concluido_em&&!await existe(resolve(deps.pastaEstado,'publicacao-pendente.json'))){await persistir('concluido',{motivo:estado.motivo_parada});return p}
      const publicacao=resolve(base,'publicacao.json'),original=resolve(base,'original.csv'),final=resolve(base,'final.csv')
      if(!(await existe(publicacao))||!(await existe(original))||!(await existe(final))){await persistir('pendente',{motivo:'legado_pendente'});return p}
      const dados=await lerJson(publicacao)
      if(dados.pedido!==v.pedido_id||!objeto(dados.recibo)||dados.recibo.versao===2||dados.recibo.validacao_conferida!==true)throw falha()
      await persistir('entregar')
      await cli('entregar',['--publicacao',publicacao,'--original',original,'--final',final])
      const confirmado=await consultar()
      if(!confirmado.concluido_em)throw falha()
      await persistir('concluido',{motivo:confirmado.motivo_parada});return p
    }
    const rodadaPasta=(n:number)=>resolve(deps.campanha,'coletas','agentes',v.vendedor_id,v.pedido_id,a.vinculo.execucao_id,'coleta-'+String(n).padStart(2,'0'))
    const brutos=()=>Array.from({length:p.coleta},(_,i)=>resolve(rodadaPasta(i+1),'bruto_original_full.csv'))
    const arquivar=async(lote:string|null)=>{
      const s=await prepararArquivamento(a,lote,brutos())
      const pasta=lote?dirname(lote):rodadaPasta(p.coleta)
      const caminhoProva=resolve(pasta,lote?'comprovante-drive.json':'comprovante-drive-brutos.json')
      const prova=await existe(caminhoProva)?conferirComprovante(s,await lerJson(caminhoProva)):conferirComprovante(s,await deps.arquivar(s))
      await salvarImutavel(caminhoProva,JSON.stringify(prova,null,2))
      return prova
    }
    const decidir=async(e:ProgressoGoogle,novidades:number)=>{
      const r=ultimaLinha(await python('rodadas.py','decidir',['--entregues',String(e.entregues),'--analisadas',String(e.analisadas),'--lotes',String(e.lotes),'--novidades',String(novidades)]))
      if(![...motivos,'continuar'].includes(r))throw falha()
      return r
    }
    const concluir=async(motivo:string,arquivarBrutos:boolean)=>{
      if(!motivos.includes(motivo))throw falha()
      const destino=resolve(base,'conclusao.json')
      await salvarImutavel(destino,JSON.stringify({motivo,arquivarBrutos},null,2))
      if(arquivarBrutos&&p.coleta>0){await persistir('arquivar');await arquivar(null)}
      await persistir('concluir')
      await cli('concluir',['--pedido',v.pedido_id,'--motivo',motivo])
      await persistir('concluido',{lote:null,motivo})
    }
    const enviarPublicacao=async(lote:string)=>{
      const pasta=dirname(lote),publicacao=resolve(pasta,'publicacao.json')
      await persistir('entregar')
      await cli('entregar',['--publicacao',publicacao,'--original',resolve(pasta,'original.csv'),'--resultado',resolve(pasta,'verificacoes.json')])
      await persistir('retomar',{lote:null,motivo:null})
    }
    for(let passo=0;passo<30;passo++){
      const e=await consultar()
      if(p.lote){
        await confinarCaminho(deps.pastaEstado,p.lote)
        if(await existe(p.lote)){
          const dados=await lerJson(p.lote)
          const publicado=e.lotes_confirmados.find(l=>l.id===dados.lote_id)
          const publicacao=resolve(dirname(p.lote),'publicacao.json')
          if(publicado){
            const original=await hashArquivo(resolve(dirname(p.lote),'original.csv'))
            const resultado=await hashArquivo(resolve(dirname(p.lote),'verificacoes.json'))
            if(original.sha256!==publicado.origem_sha256||resultado.sha256!==publicado.resultado_sha256)throw falha()
            if(await existe(resolve(deps.pastaEstado,'publicacao-pendente.json')))await enviarPublicacao(p.lote)
            else await persistir('retomar',{lote:null,motivo:null})
            continue
          }
          if(await existe(publicacao)){await enviarPublicacao(p.lote);continue}
        }
      }
      const conclusaoLocal=resolve(base,'conclusao.json')
      if(e.lote_pendente&&await existe(conclusaoLocal)){
        // A reservation proves conclusion has not committed. Preserve the premature intent for audit.
        await rename(conclusaoLocal,resolve(base,'conclusao-prematura-'+randomUUID()+'.json'))
        const operacao=resolve(deps.pastaEstado,'operacao-pendente.json')
        if(await existe(operacao)){
          const op=await lerJson(operacao)
          if(!objeto(op.comando)||op.comando.acao!=='concluir'||op.comando.pedido!==v.pedido_id||op.comando.executor!==v.executor)throw falha()
          await rename(operacao,resolve(base,'operacao-prematura-'+randomUUID()+'.json'))
        }
      }
      if(await existe(conclusaoLocal)&&(!e.concluido_em||await existe(resolve(deps.pastaEstado,'operacao-pendente.json')))){
        const c=await lerJson(conclusaoLocal)
        if(typeof c.arquivarBrutos!=='boolean'||(e.concluido_em&&e.motivo_parada!==c.motivo))throw falha()
        await concluir(String(c.motivo),c.arquivarBrutos);return p
      }
      if(e.concluido_em){await persistir('concluido',{lote:null,motivo:e.motivo_parada});return p}
      if(!e.lote_pendente&&(e.entregues>=50||e.lotes>=3||e.analisadas>=150)){await concluir(await decidir(e,0),false);return p}
      if(p.etapa==='coletar'){
        const pasta=rodadaPasta(p.coleta)
        const existente=await existe(resolve(pasta,'job.json'))||await existe(resolve(pasta,'intencao.json'))||await existe(resolve(pasta,'dados_preparados.json'))
        if(!existente&&!await deps.admitirColeta(p)){await persistir('pendente',{motivo:'coletar_pendente'});return p}
        await cli('etapa',['--pedido',v.pedido_id,'--estado','coletando'])
        const retorno=ultimaLinha(await python('coletar.py','coletar',['--pedido',contextoLocal,'--campanha',deps.campanha,'--rodada',String(p.coleta),'--motor',p.motor]))
        if((process.platform==='win32'?retorno.toLowerCase():retorno)!==(process.platform==='win32'?pasta.toLowerCase():pasta))throw falha()
        await persistir('selecionar',{motivo:null});continue
      }
      let lote=p.lote&&await existe(p.lote)?p.lote:null
      if(!lote&&e.lote_pendente){
        lote=resolve(base,'lotes',String(e.lote_pendente.ordinal).padStart(2,'0'),'lote.json')
        if(!await existe(lote))throw falha()
        const salvo=await lerJson(lote)
        if(salvo.lote_id!==e.lote_pendente.id||!isDeepStrictEqual(salvo.candidatas,e.lote_pendente.candidatas))throw falha()
        await persistir('reservar',{lote})
      }
      if(!lote){
        const pool:Record<string,unknown>[]=[]
        for(let n=1;n<=p.coleta;n++){
          const dados=await lerJson(resolve(rodadaPasta(n),'dados_preparados.json'))
          if(!Array.isArray(dados.all)||!dados.all.every(objeto))throw falha()
          pool.push(...dados.all)
        }
        const poolPath=resolve(base,'pool-'+p.coleta+'.json'),vistas=resolve(base,'vistas-'+e.lotes+'.json')
        await salvarImutavel(poolPath,JSON.stringify({all:pool},null,2));await salvarImutavel(vistas,JSON.stringify(e.vistas))
        lote=resolve(base,'lotes',String(e.lotes+1).padStart(2,'0'),'lote.json')
        await persistir(p.etapa,{lote})
        await mkdir(dirname(lote),{recursive:true})
        await python('rodadas.py','selecionar',['--candidatas',poolPath,'--vistas',vistas,'--restante',String(150-e.analisadas),'--saida',lote])
        if(!await existe(lote)){
          await persistir(p.etapa,{lote:null})
          if(p.etapa==='selecionar'||p.coleta>=3){await concluir(await decidir(e,0),p.etapa==='selecionar');return p}
          await persistir('coletar',{coleta:p.coleta+1,motivo:null})
          continue
        }
      }
      const dados=await lerJson(lote)
      if(typeof dados.lote_id!=='string'||!Array.isArray(dados.candidatas)||dados.candidatas.length<1||dados.candidatas.length>50)throw falha()
      const intencaoOperacao=resolve(deps.pastaEstado,'operacao-pendente.json')
      if(await existe(intencaoOperacao)){
        const op=await lerJson(intencaoOperacao)
        if(!objeto(op.comando)||op.comando.acao!=='reservar_lote'||op.comando.pedido!==v.pedido_id||op.comando.executor!==v.executor||!objeto(op.comando.lote)||op.comando.lote.lote_id!==dados.lote_id)throw falha()
        await persistir('reservar',{lote})
        await cli('reservar_lote',['--pedido',v.pedido_id,'--lote',lote])
      }
      if(e.lote_pendente){if(e.lote_pendente.id!==dados.lote_id||!isDeepStrictEqual(e.lote_pendente.candidatas,dados.candidatas))throw falha()}
      else{await persistir('reservar',{lote});await cli('reservar_lote',['--pedido',v.pedido_id,'--lote',lote])}
      await cli('etapa',['--pedido',v.pedido_id,'--estado','validando'])
      await persistir('verificar',{lote})
      const pasta=dirname(lote),resultado=resolve(pasta,'verificacoes.json')
      await cli('verificar',['--contexto',contextoLocal,'--lote',lote,'--saida',resultado])
      await persistir('arquivar')
      const prova=await arquivar(lote)
      const ver=await lerJson(resultado)
      const original=resolve(pasta,'original.csv')
      const recibo={versao:2,pedido_id:v.pedido_id,execucao_id:a.vinculo.execucao_id,lote_id:dados.lote_id,revisao:a.vinculo.revisao,snapshot_sha256:a.vinculo.snapshot_sha256,
        origem_sha256:(await hashArquivo(original)).sha256,resultado_sha256:(await hashArquivo(resultado)).sha256,arquivo_original_id:prova.arquivos.find(f=>f.tipo==='original')!.id,arquivo_resultado_id:prova.arquivos.find(f=>f.tipo==='resultado')!.id,verificacoes_requeridas:ver.verificacoes_requeridas,evidencias:ver.evidencias}
      const reciboPath=resolve(pasta,'recibo.json'),publicacao=resolve(pasta,'publicacao.json')
      await salvarImutavel(reciboPath,JSON.stringify(recibo,null,2))
      await python('coletar.py','preparar',['--pedido',contextoLocal,'--coletadas',lote,'--original',original,'--resultado',resultado,'--recibo',reciboPath,'--saida',publicacao])
      await enviarPublicacao(lote)
    }
    throw falha()
  }catch{
    const etapa=p.etapa==='pendente'?'retomar':p.etapa
    await persistir('pendente',{motivo:etapa+'_pendente'})
    return p
  }
}