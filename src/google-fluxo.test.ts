import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { randomUUID, createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'
import { criteriosVazios } from './lib/google/criterios'
import { lerComando } from './server/google/protocolo'
import { coordenar, type ServicosPool } from '../scripts/google/coordenar.mts'
import { executarPedido } from '../scripts/google/fluxo.mts'
import type { Posicao, SolicitacaoDrive, ComprovanteDrive, DependenciasFluxo, MotorId } from '../scripts/google/coordenador-tipos.mts'
const executar=promisify(execFile)
const candidatas=(n:number)=>Array.from({length:n},(_,i)=>({google_place_id:'place-'+i,nome_fantasia:'Loja '+i,telefone:null,cnpj:null}))
async function fixture(coletas:Record<string,unknown>[][],aceitar:number[]=[],perderEntrega=false,perderReserva=false,perderConclusao=false,motor:MotorId='01',falharReservaEm=1){
 const raiz=await mkdtemp(join(tmpdir(),'crm-fluxo-'))
 const pastaEstado=join(raiz,'estado'),campanha=join(raiz,'campanha')
 await mkdir(pastaEstado,{recursive:true});await mkdir(campanha)
 const v={motor,executor:randomUUID(),pedido_id:randomUUID(),execucao_id:randomUUID(),vendedor_id:randomUUID(),revisao:1,snapshot_sha256:'a'.repeat(64)}
 const contexto=join(pastaEstado,'pedido-inicial.json')
 const p={id:v.pedido_id,vendedor_id:v.vendedor_id,executor:v.executor,execucao_id:v.execucao_id,revisao:1,snapshot_sha256:v.snapshot_sha256,contrato:2,motor:v.motor,dia:'2026-10-26',nicho:'Brinquedos',bairro:'BrÃ¡s',cidade:'SÃ£o Paulo',uf:'SP',criterios:criteriosVazios(),estado:'coletando'}
 await writeFile(contexto,JSON.stringify(p));await writeFile(join(pastaEstado,'executor.json'),JSON.stringify({id:v.executor}))
 let posicao:Posicao={motor,associacao:{contrato:2,vinculo:v},etapa:'retomar',contexto,lote:null,coleta:0,motivo:null}
 const chamadas:string[]=[],entregas:unknown[]=[],arquivos:SolicitacaoDrive[]=[]
 const lotes:{id:string;ordinal:number;candidatas:Record<string,unknown>[];concluido:boolean;recibo:Record<string,unknown>|null;entregues:number}[]=[]
 let entregues=0,motivo:string|null=null,encerrado=false,perdido=false,reservaPerdida=false,conclusaoPerdida=false
 const servidor=createServer(async(req,res)=>{
  const partes:Buffer[]=[];for await(const b of req)partes.push(Buffer.from(b))
  const entrada=await lerComando(new Request('http://localhost',{method:'POST',body:Buffer.concat(partes)}))
  res.setHeader('Content-Type','application/json')
  if(!entrada.ok){res.statusCode=400;res.end('{}');return}
  const c=entrada.comando;chamadas.push('crm:'+c.acao)
  if(c.acao==='proximo')throw new Error('Consulta nÃ£o deve reivindicar pedido')
  if(c.acao==='consultar'){
    const pendente=lotes.find(l=>!l.concluido)
    res.end(JSON.stringify({execucao:{pedido_id:v.pedido_id,execucao_id:v.execucao_id,executor_id:v.executor,vendedor_id:v.vendedor_id,contrato:2,revisao:1,snapshot_sha256:v.snapshot_sha256,analisadas:lotes.reduce((n,l)=>n+l.candidatas.length,0),entregues,lotes:lotes.length,concluido_em:encerrado?'2026-10-26T21:00:00Z':null,motivo_parada:motivo,vistas:lotes.flatMap(l=>l.candidatas.flatMap(c=>[String(c.google_place_id),...(c.cnpj?['cnpj:'+c.cnpj]:[])])),lote_pendente:pendente?{id:pendente.id,ordinal:pendente.ordinal,candidatas:pendente.candidatas}:null,lotes_confirmados:lotes.filter(l=>l.concluido).map(l=>({id:l.id,ordinal:l.ordinal,resposta:{resultado:'ok',entregues:l.entregues},origem_sha256:l.recibo?.origem_sha256,resultado_sha256:l.recibo?.resultado_sha256}))}}));return
  }
  if(c.acao==='reservar_lote'){
    let lote=lotes.find(l=>l.id===c.lote.lote_id)
    if(!lote){lote={id:String(c.lote.lote_id),ordinal:lotes.length+1,candidatas:c.lote.candidatas as Record<string,unknown>[],concluido:false,recibo:null,entregues:0};lotes.push(lote)}
    expect(lotes.length).toBeLessThanOrEqual(3)
    expect(lotes.reduce((n,l)=>n+l.candidatas.length,0)).toBeLessThanOrEqual(150)
    if(perderReserva&&!reservaPerdida&&lote.ordinal===falharReservaEm){reservaPerdida=true;req.socket.destroy();return}
    res.end(JSON.stringify({lote}));return
  }
  if(c.acao==='etapa'){res.end('{"resultado":"ok"}');return}
  if(c.acao==='entregar'){
    entregas.push(c)
    const l=lotes.find(l=>l.id===c.recibo.lote_id)!
    const repetida=l.concluido
    if(!repetida){l.concluido=true;l.recibo=c.recibo;l.entregues=Math.min(50-entregues,aceitar[l.ordinal-1]??c.empresas.length);entregues+=l.entregues}
    if(perderEntrega&&!perdido){perdido=true;req.socket.destroy();return}
    res.end(JSON.stringify({resultado:repetida?'repetida':'ok'}));return
  }
  if(c.acao==='concluir'&&lotes.some(l=>!l.concluido)){res.statusCode=409;res.end('{}');return}
  if(c.acao==='concluir'){motivo=c.motivo;encerrado=true;if(perderConclusao&&!conclusaoPerdida){conclusaoPerdida=true;req.socket.destroy();return};res.end(JSON.stringify({resultado:{motivo_parada:motivo,entregues}}));return}
  res.statusCode=400;res.end('{}')
 })
 await new Promise<void>(r=>servidor.listen(0,'127.0.0.1',r))
 const {port}=servidor.address() as {port:number}
 const env={...process.env,GOOGLE_CRM_URL:'http://127.0.0.1:'+port,GOOGLE_AGENTE_TOKEN:'fixture',GOOGLE_VERIFICACOES_URL:'http://127.0.0.1:'+port+'/verificar',GOOGLE_VERIFICACOES_TOKEN:'fixture',PYTHONDONTWRITEBYTECODE:'1'}
 const deps={campanha,pastaEstado,
  async comando(programa:'node'|'python',args:readonly string[]){
   expect(args.some(a=>a.startsWith('--env-file'))).toBe(false)
   const flag=(k:string)=>args[args.indexOf('--'+k)+1]
   const indice=args.indexOf('scripts/google/coletar.py')
   if(programa==='python'&&indice>=0&&args[indice+1]==='coletar'){
    const rodada=Number(flag('rodada'));chamadas.push('coletar:'+rodada)
    const pasta=join(campanha,'coletas','agentes',v.vendedor_id,v.pedido_id,v.execucao_id,'coleta-'+String(rodada).padStart(2,'0'))
    await mkdir(pasta,{recursive:true})
    await writeFile(join(pasta,'pedido.json'),JSON.stringify(p))
    await writeFile(join(pasta,'dados_preparados.json'),JSON.stringify({all:coletas[rodada-1]??[]}))
    await writeFile(join(pasta,'bruto_original_full.csv'),'place_id,title\r\n'+(coletas[rodada-1]??[]).map(c=>c.google_place_id+','+c.nome_fantasia).join('\r\n'))
    return pasta+'\n'
   }
   if(programa==='node'){
    chamadas.push('cli:'+args[args.indexOf('scripts/google/agente.mts')+1])
    return (await executar(process.execPath,[...args],{env,timeout:20000})).stdout
   }
   expect(args.includes('scripts/google/rodadas.py')||(indice>=0&&args[indice+1]==='preparar')).toBe(true)
   return (await executar(process.platform==='win32'?'python':'python3',[...args],{env,timeout:10000})).stdout
  },
  async admitirColeta(){return true},
  async arquivar(s:SolicitacaoDrive):Promise<ComprovanteDrive>{
   chamadas.push('drive');arquivos.push(s)
   return {associacao:s.associacao,solicitacao_id:s.solicitacao_id,lote_id:s.lote_id,pasta_id:'pasta_google_fixture',arquivos:s.arquivos.map(a=>({tipo:a.tipo,nome:a.nome,id:'file_'+createHash('sha256').update(a.nome).digest('hex').slice(0,20),pasta_id:'pasta_google_fixture',bytes:a.bytes,sha256:a.sha256,downloadConferido:true}))}
  },
  async persistir(p:Posicao){posicao=structuredClone(p)},
 }
 return {deps,chamadas,entregas,arquivos,get posicao(){return posicao},get motivo(){return motivo},get entregues(){return entregues},get lotes(){return lotes},async limpar(){await new Promise<void>(r=>servidor.close(()=>r()));await rm(raiz,{recursive:true,force:true})}}
}

test('reserva verifica arquiva e entrega antes de parar pela meta do servidor',async()=>{
 const f=await fixture([candidatas(100)],[50])
 try{
  const p=await executarPedido(f.posicao,f.deps)
  expect(p.etapa,p.motivo??'').toBe('concluido');expect(f.motivo).toBe('meta_atingida')
  expect(f.entregues).toBe(50);expect(f.lotes).toHaveLength(1)
  expect(f.chamadas.filter(c=>c.startsWith('coletar:'))).toEqual(['coletar:1'])
  expect(f.chamadas.indexOf('crm:reservar_lote')).toBeLessThan(f.chamadas.indexOf('cli:verificar'))
  expect(f.chamadas.indexOf('drive')).toBeLessThan(f.chamadas.indexOf('crm:entregar'))
  expect(f.chamadas).not.toContain('crm:proximo')
 }finally{await f.limpar()}
},90000)
test('consome pool em tres lotes e limita 150 distintas sem novo job',async()=>{
 const f=await fixture([candidatas(160)],[0,0,0])
 try{
  expect((await executarPedido(f.posicao,f.deps)).etapa).toBe('concluido')
  expect(f.motivo).toBe('limite_lotes');expect(f.lotes.map(l=>l.candidatas.length)).toEqual([50,50,50])
  expect(new Set(f.lotes.flatMap(l=>l.candidatas.map(c=>c.google_place_id))).size).toBe(150)
  expect(f.chamadas.filter(c=>c.startsWith('coletar:'))).toEqual(['coletar:1'])
 }finally{await f.limpar()}
},90000)
test('coleta complementar sem novidades encerra e arquiva bruto sem lote vazio',async()=>{
 const f=await fixture([candidatas(20),candidatas(20)],[3])
 try{
  expect((await executarPedido(f.posicao,f.deps)).etapa).toBe('concluido')
  expect(f.motivo).toBe('sem_novidades');expect(f.lotes).toHaveLength(1)
  expect(f.chamadas.filter(c=>c.startsWith('coletar:'))).toEqual(['coletar:1','coletar:2'])
  expect(f.arquivos.at(-1)?.lote_id).toBeNull()
 }finally{await f.limpar()}
},90000)
test('coleta vazia nao verifica nem reserva lote e conclui sem resultados',async()=>{
 const f=await fixture([[]])
 try{
  expect((await executarPedido(f.posicao,f.deps)).etapa).toBe('concluido')
  expect(f.motivo).toBe('sem_resultados');expect(f.lotes).toHaveLength(0)
  expect(f.chamadas).not.toContain('cli:verificar')
 }finally{await f.limpar()}
},60000)
test('resposta de entrega perdida retoma mesmo corpo sem outra coleta ou verificacao',async()=>{
 const f=await fixture([candidatas(50)],[50],true)
 try{
  const pendente=await executarPedido(f.posicao,f.deps)
  expect(pendente.etapa).toBe('pendente')
  const pronto=await executarPedido(pendente,f.deps)
  expect(pronto.etapa,pronto.motivo??'').toBe('concluido')
  expect(f.entregas).toHaveLength(2);expect(f.entregas[1]).toEqual(f.entregas[0])
  expect(f.chamadas.filter(c=>c==='cli:verificar')).toHaveLength(1)
  expect(f.chamadas.filter(c=>c.startsWith('coletar:'))).toEqual(['coletar:1'])
 }finally{await f.limpar()}
},90000)
test('admissao de RAM acontece uma vez antes de cada nova coleta',async()=>{
 const f=await fixture([candidatas(50)],[50]);let admissoes=0
 f.deps.admitirColeta=async()=>++admissoes===1
 try{
  const p=await executarPedido(f.posicao,f.deps)
  expect(p.etapa,p.motivo??'').toBe('concluido')
  expect(admissoes).toBe(1)
 }finally{await f.limpar()}
},90000)
test('upload incerto de bruto retoma a mesma solicitacao antes de concluir',async()=>{
 const f=await fixture([[]]);let tentativa=0
 const arquivar=f.deps.arquivar
 f.deps.arquivar=async s=>{const prova=await arquivar(s);if(++tentativa===1)throw new Error('Retorno perdido');return prova}
 try{
  const p=await executarPedido(f.posicao,f.deps)
  expect(p.etapa).toBe('pendente')
  expect((await executarPedido(p,f.deps)).etapa).toBe('concluido')
  expect(f.chamadas.filter(c=>c.startsWith('coletar:'))).toEqual(['coletar:1'])
  expect(f.arquivos).toHaveLength(2)
  expect(f.arquivos[0].solicitacao_id).toBe(f.arquivos[1].solicitacao_id)
 }finally{await f.limpar()}
},90000)
test('reserva incerta e reconciliada antes da verificacao sem consumir outro lote',async()=>{
 const f=await fixture([candidatas(50)],[50],false,true)
 try{
  const p=await executarPedido(f.posicao,f.deps)
  expect(p.etapa).toBe('pendente')
  const pronto=await executarPedido(p,f.deps)
  expect(pronto.etapa,pronto.motivo??'').toBe('concluido')
  expect(f.lotes).toHaveLength(1)
  expect(f.chamadas.filter(c=>c==='crm:reservar_lote')).toHaveLength(2)
 }finally{await f.limpar()}
},90000)
test('selecao interrompida sem arquivo retoma com o mesmo contexto e sem nova coleta',async()=>{
 const f=await fixture([candidatas(50)],[50]);let interrompida=false
 const comando=f.deps.comando
 f.deps.comando=async(programa,args)=>{
  if(!interrompida&&args.includes('selecionar')&&args.some(a=>a.endsWith('pool-1.json'))){interrompida=true;throw new Error('Processo caiu')}
  return comando(programa,args)
 }
 try{
  const p=await executarPedido(f.posicao,f.deps)
  expect(p.etapa).toBe('pendente')
  const pronto=await executarPedido(p,f.deps)
  expect(pronto.etapa,pronto.motivo??'').toBe('concluido')
  expect(f.chamadas.filter(c=>c.startsWith('coletar:'))).toEqual(['coletar:1'])
 }finally{await f.limpar()}
},90000)
test.each([false,true])('V1 entrega publicacao preparada sem recibo V2 (resposta perdida: %s)',async perder=>{
 const raiz=await mkdtemp(join(tmpdir(),'crm-fluxo-v1-'))
 const pastaEstado=join(raiz,'estado');await mkdir(pastaEstado)
 const v={motor:'01' as const,executor:randomUUID(),pedido_id:randomUUID(),vendedor_id:randomUUID()}
 const contexto=join(pastaEstado,'pedido-inicial.json')
 await writeFile(contexto,JSON.stringify({id:v.pedido_id,vendedor_id:v.vendedor_id,executor:v.executor,contrato:1,dia:'2026-10-26',nicho:'Brinquedos',bairro:'BrÃ¡s',cidade:'SÃ£o Paulo',uf:'SP',estado:'validando'}))
 await writeFile(join(pastaEstado,'executor.json'),JSON.stringify({id:v.executor}))
 const base=join(pastaEstado,'pedidos',v.pedido_id,'legado');await mkdir(base,{recursive:true})
 const original=Buffer.from('telefone,google_place_id\r\n1133334444,legado\r\n')
 const final=Buffer.from('telefone,google_place_id\r\n1133334444,legado\r\n')
 await writeFile(join(base,'original.csv'),original);await writeFile(join(base,'final.csv'),final)
 const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex')
 const recibo={pedido_id:v.pedido_id,validacao_conferida:true,origem_sha256:hash(original),final_sha256:hash(final),arquivo_original_id:'arquivo_legado_original',arquivo_final_id:'arquivo_legado_final'}
 await writeFile(join(base,'publicacao.json'),JSON.stringify({acao:'entregar',pedido:v.pedido_id,empresas:[{google_place_id:'legado',nome_fantasia:'Loja',telefone:'1133334444',validado:true}],recibo}))
 let concluido=false,perdaSimulada=false
 const recebidos:Record<string,unknown>[]=[]
 const servidor=createServer(async(req,res)=>{
  const partes:Buffer[]=[];for await(const b of req)partes.push(Buffer.from(b))
  const c=JSON.parse(Buffer.concat(partes).toString()) as Record<string,unknown>;recebidos.push(c)
  res.setHeader('Content-Type','application/json')
  if(c.acao==='consultar')res.end(JSON.stringify({execucao:{pedido_id:v.pedido_id,execucao_id:'id-interno-antigo',executor_id:v.executor,vendedor_id:v.vendedor_id,contrato:1,revisao:null,snapshot_sha256:null,analisadas:0,entregues:0,lotes:0,concluido_em:concluido?'2026-10-26T21:00:00Z':null,motivo_parada:null,vistas:[],lote_pendente:null,lotes_confirmados:[]}}))
  else if(c.acao==='entregar'){concluido=true;if(perder&&!perdaSimulada){perdaSimulada=true;req.socket.destroy();return};res.end('{"resultado":"ok"}')}
  else{res.statusCode=400;res.end('{}')}
 })
 await new Promise<void>(r=>servidor.listen(0,'127.0.0.1',r))
 try{
  const {port}=servidor.address() as {port:number}
  const p:Posicao={motor:'01',associacao:{contrato:1,vinculo:v},etapa:'retomar',contexto,lote:null,coleta:0,motivo:null}
  const dependenciasLegadas:DependenciasFluxo={campanha:raiz,pastaEstado,
   async comando(programa,args){expect(programa).toBe('node');return (await executar(process.execPath,[...args],{env:{...process.env,GOOGLE_CRM_URL:'http://127.0.0.1:'+port,GOOGLE_AGENTE_TOKEN:'fixture'},timeout:20000})).stdout},
   async admitirColeta(){throw new Error('NÃ£o coletar outro contrato legado')},
   async arquivar(){throw new Error('Recibo legado jÃ¡ foi arquivado no fluxo antigo')},
   async persistir(){},
  }
  let pronto=await executarPedido(p,dependenciasLegadas)
  if(perder){expect(pronto.etapa).toBe('pendente');pronto=await executarPedido(pronto,dependenciasLegadas)}
  expect(pronto.etapa,pronto.motivo??'').toBe('concluido')
  const entrega=recebidos.find(c=>c.acao==='entregar')!
  expect(entrega.recibo).toEqual(recibo)
  expect((entrega.recibo as Record<string,unknown>).versao).toBeUndefined()
  expect(entrega.execucao_id).toBeUndefined()
  expect(recebidos.map(c=>c.acao)).toEqual(perder?['consultar','entregar','consultar','entregar','consultar']:['consultar','entregar','consultar'])
  await expect(readFile(join(pastaEstado,'publicacao-pendente.json'))).rejects.toMatchObject({code:'ENOENT'})
 }finally{await new Promise<void>(r=>servidor.close(()=>r()));await rm(raiz,{recursive:true,force:true})}
},60000)
test('conclusao confirmada no servidor limpa intencao local apos resposta perdida',async()=>{
 const f=await fixture([candidatas(50)],[50],false,false,true)
 try{
  const p=await executarPedido(f.posicao,f.deps)
  expect(p.etapa).toBe('pendente')
  const pronto=await executarPedido(p,f.deps)
  expect(pronto.etapa,pronto.motivo??'').toBe('concluido')
  await expect(readFile(join(f.deps.pastaEstado,'operacao-pendente.json'))).rejects.toMatchObject({code:'ENOENT'})
  expect(f.chamadas.filter(c=>c==='crm:concluir')).toHaveLength(2)
  expect(f.chamadas.filter(c=>c.startsWith('coletar:'))).toEqual(['coletar:1'])
 }finally{await f.limpar()}
},90000)
test('pool real conserva tres pipelines e recibos com uma falha isolada', async () => {
  const fixtures = await Promise.all((['01', '02', '03'] as const).map(m => fixture([candidatas(2)], [2], false, false, false, m)))
  let soltar!: () => void, avisar!: () => void, entradas = 0
  const barreira = new Promise<void>(r => { soltar = r })
  const tres = new Promise<void>(r => { avisar = r })
  const feitos = new Set<MotorId>()
  const deps: ServicosPool = {
    excluir: async () => ({ liberar: async () => {} }), dono: async () => ({ pid: 1, inicio: 'fixture' }),
    ler: async () => null, salvar: async () => {},
    medir: async () => ({ ok: true, disponivelMiB: 7000, instante: new Date().toISOString() }),
    conferir: async () => true, evento: () => {}, intervaloMs: 0,
    proximo: async m => { if (feitos.has(m)) return null; feitos.add(m); return fixtures[Number(m)-1].posicao },
    executar: (p, gate, persistir) => {
      const f = fixtures[Number(p.motor)-1], original = f.deps.comando
      return executarPedido(p, { ...f.deps, admitirColeta: gate, persistir,
        comando: async (programa, args) => {
          if (programa === 'python' && args.includes('coletar')) {
            if (++entradas === 3) avisar()
            await barreira
            if (p.motor === '02') throw new Error('Falha isolada de coleta')
          }
          return original(programa, args)
        }
      })
    },
  }
  try {
    const run = coordenar('rodar', deps)
    await tres
    expect(entradas).toBe(3)
    soltar()
    const j = await run
    expect(j.posicoes.filter(p => p.etapa === 'concluido')).toHaveLength(2)
    expect(j.posicoes[1].etapa).toBe('pendente')
    expect(fixtures[1].entregas).toHaveLength(0)
    expect(fixtures[0].arquivos[0].associacao.vinculo.motor).toBe('01')
    expect(fixtures[2].arquivos[0].associacao.vinculo.motor).toBe('03')
    expect(fixtures[0].arquivos[0].lote_id).not.toBe(fixtures[2].arquivos[0].lote_id)
  } finally { soltar(); await Promise.all(fixtures.map(f => f.limpar())) }
}, 90000)


test('retoma resposta perdida da terceira reserva antes de concluir orçamento', async () => {
  const f = await fixture([candidatas(150)], [0, 0, 0], false, true, false, '01', 3)
  try {
    expect((await executarPedido(f.posicao, f.deps)).etapa).toBe('pendente')
    expect(f.lotes).toHaveLength(3)
    expect(f.lotes[2].concluido).toBe(false)
    expect((await executarPedido(f.posicao, f.deps)).etapa).toBe('concluido')
    expect(f.lotes[2].concluido).toBe(true)
    expect(f.motivo).toBe('limite_lotes')
  } finally { await f.limpar() }
}, 90000)
test.each(['verificar', 'drive'] as const)('terceiro lote retoma falha de %s e preserva conclusão prematura', async etapa => {
  const f = await fixture([candidatas(150)], [0, 0, 0])
  const original = f.deps.comando, upload = f.deps.arquivar
  let verificacoes = 0, uploads = 0
  f.deps.comando = async (programa, args) => {
    if (etapa === 'verificar' && args.includes('verificar') && ++verificacoes === 3) throw new Error('Interrupção antes da verificação')
    return original(programa, args)
  }
  f.deps.arquivar = async s => { if (etapa === 'drive' && ++uploads === 3) throw new Error('Interrupção no Drive'); return upload(s) }
  try {
    expect((await executarPedido(f.posicao, f.deps)).etapa).toBe('pendente')
    expect(f.lotes[2].concluido).toBe(false)
    const v = f.posicao.associacao!.vinculo
    if (f.posicao.associacao!.contrato !== 2) throw new Error('Fixture V2')
    const base = join(f.deps.pastaEstado, 'pedidos', v.pedido_id, f.posicao.associacao!.vinculo.execucao_id)
    await writeFile(join(base, 'conclusao.json'), JSON.stringify({ motivo: 'limite_lotes', arquivarBrutos: false }))
    await writeFile(join(f.deps.pastaEstado, 'operacao-pendente.json'), JSON.stringify({ comando: { acao: 'concluir', pedido: v.pedido_id, executor: v.executor, motivo: 'limite_lotes' } }))
    expect((await executarPedido(f.posicao, f.deps)).etapa).toBe('concluido')
    expect(f.lotes[2].concluido).toBe(true)
    expect(f.lotes).toHaveLength(3)
  } finally { await f.limpar() }
}, 90000)
