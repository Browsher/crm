import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

test('CLI persiste executor antes do POST e retoma a identidade após resposta incerta',async()=>{
  const pasta=await mkdtemp(join(tmpdir(),'crm-google-executor-'))
  const recebidos: unknown[]=[]
  const salvos: unknown[]=[]
  const servidor=createServer(async(req,res)=>{
    const partes: Buffer[]=[]
    for await (const parte of req) partes.push(Buffer.from(parte))
    recebidos.push(JSON.parse(Buffer.concat(partes).toString()).executor)
    try { salvos.push(JSON.parse(await readFile(join(pasta,'executor.json'),'utf8')).id) } catch { salvos.push(null) }
    if(recebidos.length===1) { req.socket.destroy(); return }
    res.setHeader('Content-Type','application/json')
    res.end(JSON.stringify({pedido:null}))
  })
  await new Promise<void>(r=>servidor.listen(0,'127.0.0.1',r))
  try {
    const endereco=servidor.address()
    if(!endereco || typeof endereco==='string') throw new Error('Servidor indisponível')
    const env={...process.env,GOOGLE_CRM_URL:'http://127.0.0.1:'+endereco.port,GOOGLE_AGENTE_TOKEN:'token-ficticio-do-executor'}
    const args=['--import','tsx','scripts/google/agente.mts','proximo','--pasta',pasta]
    await expect(promisify(execFile)(process.execPath,args,{env,timeout:25000})).rejects.toThrow()
    await promisify(execFile)(process.execPath,args,{env,timeout:25000})
    expect(recebidos[0]).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
    expect(recebidos).toEqual([salvos[0],salvos[0]])
    expect(salvos[1]).toBe(salvos[0])
  } finally {
    await new Promise<void>((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()))
    await rm(pasta,{recursive:true,force:true})
  }
},60000)
test('CLI V2 entrega sem arquivo WhatsApp e mantém a mesma publicação após resposta perdida', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'crm-google-lote-'))
  const pedido = randomUUID()
  const lote = randomUUID()
  const original = join(pasta, 'original.csv')
  const resultado = join(pasta, 'resultado.json')
  const publicacao = join(pasta, 'publicacao.json')
  await writeFile(original, 'Dados originais preservados')
  await writeFile(resultado, '[]')
  const hash = async (p: string) => createHash('sha256').update(await readFile(p)).digest('hex')
  await writeFile(publicacao, JSON.stringify({ acao: 'entregar', pedido, empresas: [], recibo: { versao: 2, pedido_id: pedido, execucao_id: randomUUID(), lote_id: lote, revisao: 1,
    snapshot_sha256: 'c'.repeat(64), origem_sha256: await hash(original), resultado_sha256: await hash(resultado), arquivo_original_id: 'original', arquivo_resultado_id: 'resultado', verificacoes_requeridas: [], evidencias: [] } }))
  let pedidos = 0
  const servidor = createServer(async (req, res) => {
    pedidos++
    for await (const _parte of req) { void _parte }
    if (pedidos === 1) { req.socket.destroy(); return }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ resultado: 'ok' }))
  })
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r))
  try {
    const endereco = servidor.address()
    if (!endereco || typeof endereco === 'string') throw new Error('Servidor indisponível')
    const env = { ...process.env, GOOGLE_CRM_URL: 'http://127.0.0.1:' + endereco.port, GOOGLE_AGENTE_TOKEN: 'token-ficticio' }
    const cli = (acao: string, extra: string[] = []) => promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/google/agente.mts', acao, '--pasta', pasta, ...extra], { env, timeout: 25000 })
    const arquivos = ['--publicacao', publicacao, '--original', original, '--resultado', resultado]
    await expect(cli('entregar', arquivos)).rejects.toThrow()
    expect(pedidos).toBe(1)
    await expect(cli('proximo')).rejects.toThrow()
    expect(pedidos).toBe(1)
    await cli('entregar', arquivos)
    expect(pedidos).toBe(2)
    expect(JSON.parse(await readFile(join(pasta, pedido + '-retorno.json'), 'utf8'))).toEqual({ resultado: 'ok' })
  } finally {
    await new Promise<void>((r, reject) => servidor.close(e => e ? reject(e) : r()))
    await rm(pasta, { recursive: true, force: true })
  }
}, 90000)
test('verificação do CLI pula workflow neutro e exige reconciliação depois de resposta perdida', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'crm-google-verificar-'))
  const id = randomUUID(), execucao_id = randomUUID(), lote_id = randomUUID()
  const contexto = join(pasta,'contexto.json'), lote = join(pasta,'lote.json'), saida = join(pasta,'verificacao.json'), resposta = join(pasta,'resposta.json')
  await writeFile(contexto,JSON.stringify({id,execucao_id,revisao:1,snapshot_sha256:'a'.repeat(64),snapshot:{criterios:{}}}))
  await writeFile(lote,JSON.stringify({lote_id,candidatas:[{google_place_id:'place',nome_fantasia:'Loja'}]}))
  let chamadas=0
  const servidor=createServer(req=>{chamadas++;req.socket.destroy()})
  await new Promise<void>(r=>servidor.listen(0,'127.0.0.1',r))
  try {
    const endereco=servidor.address()
    if(!endereco||typeof endereco==='string') throw new Error('Servidor indisponível')
    const env={...process.env,GOOGLE_CRM_URL:'http://127.0.0.1:'+endereco.port,GOOGLE_AGENTE_TOKEN:'token-ficticio',GOOGLE_VERIFICACOES_URL:'http://127.0.0.1:'+endereco.port,GOOGLE_VERIFICACOES_TOKEN:'segredo-apenas-teste'}
    const cli=(extra:string[]=[])=>promisify(execFile)(process.execPath,['--import','tsx','scripts/google/agente.mts','verificar','--pasta',pasta,'--contexto',contexto,'--lote',lote,'--saida',saida,...extra],{env,timeout:25000})
    await cli()
    expect(chamadas).toBe(0)
    await rm(saida)
    await writeFile(contexto,JSON.stringify({id,execucao_id,revisao:1,snapshot_sha256:'b'.repeat(64),snapshot:{criterios:{nota:4}}}))
    const webhook = env.GOOGLE_VERIFICACOES_URL
    env.GOOGLE_VERIFICACOES_URL = ''
    await expect(cli()).rejects.toThrow()
    await expect(readFile(join(pasta,'verificacao-pendente.json'))).rejects.toMatchObject({code:'ENOENT'})
    env.GOOGLE_VERIFICACOES_URL = webhook
    await expect(cli()).rejects.toThrow()
    expect(chamadas).toBe(1)
    await expect(cli()).rejects.toThrow()
    expect(chamadas).toBe(1)
    await writeFile(resposta,JSON.stringify({pedido_id:id,execucao_id,lote_id,revisao:1,snapshot_sha256:'b'.repeat(64),evidencias:[]}))
    await cli(['--reconciliar',resposta])
    expect(chamadas).toBe(1)
    expect(JSON.parse(await readFile(saida,'utf8')).verificacoes_requeridas).toEqual(['dados_google'])
  } finally {
    await new Promise<void>((r,reject)=>servidor.close(e=>e?reject(e):r()))
    await rm(pasta,{recursive:true,force:true})
  }
},90000)
test('CLI reserva lote com identidade persistida e confirma conclusão explícita', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'crm-google-reserva-'))
  const pedido = randomUUID()
  const lote_id = randomUUID()
  const arquivo = join(pasta, 'lote.json')
  await writeFile(arquivo, JSON.stringify({ lote_id, candidatas: [{ google_place_id: 'place' }] }))
  const recebidos: Record<string, unknown>[] = []
  const servidor = createServer(async (req, res) => {
    const partes: Buffer[] = []
    for await (const parte of req) partes.push(Buffer.from(parte))
    const comando = JSON.parse(Buffer.concat(partes).toString())
    recebidos.push(comando)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(comando.acao === 'reservar_lote' ? { lote: { id: lote_id, ordinal: 1 } } : { resultado: { motivo_parada: 'sem_novidades' } }))
  })
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r))
  try {
    const endereco = servidor.address()
    if (!endereco || typeof endereco === 'string') throw new Error('Servidor indisponível')
    const env = { ...process.env, GOOGLE_CRM_URL: 'http://127.0.0.1:' + endereco.port, GOOGLE_AGENTE_TOKEN: 'token-ficticio' }
    const cli = (acao: string, extra: string[]) => promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/google/agente.mts', acao, '--pasta', pasta, '--pedido', pedido, ...extra], { env, timeout: 25000 })
    await cli('reservar_lote', ['--lote', arquivo])
    await cli('concluir', ['--motivo', 'sem_novidades'])
    expect(recebidos.map(r => r.acao)).toEqual(['reservar_lote', 'concluir'])
    expect(recebidos[0].executor).toBe(recebidos[1].executor)
  } finally {
    await new Promise<void>((r, reject) => servidor.close(e => e ? reject(e) : r()))
    await rm(pasta, { recursive: true, force: true })
  }
}, 90000)

test('CLI consulta progresso mesmo com publicacao incerta sem reivindicar outro pedido',async()=>{
  const pasta=await mkdtemp(join(tmpdir(),'crm-google-consulta-'))
  const pedido=randomUUID(),executor=randomUUID()
  await writeFile(join(pasta,'executor.json'),JSON.stringify({id:executor}))
  await writeFile(join(pasta,'publicacao-pendente.json'),JSON.stringify({pedido,executor,publicacao_sha256:'a'.repeat(64)}))
  const comandos:unknown[]=[]
  const servidor=createServer(async(req,res)=>{
    const partes:Buffer[]=[];for await(const parte of req)partes.push(Buffer.from(parte))
    comandos.push(JSON.parse(Buffer.concat(partes).toString()))
    res.setHeader('Content-Type','application/json')
    res.end(JSON.stringify({execucao:{pedido_id:pedido,executor_id:executor,analisadas:20,entregues:4}}))
  })
  await new Promise<void>(r=>servidor.listen(0,'127.0.0.1',r))
  try{
    const {port}=servidor.address() as {port:number}
    const env={...process.env,GOOGLE_CRM_URL:'http://127.0.0.1:'+port,GOOGLE_AGENTE_TOKEN:'fixture'}
    const {stdout}=await promisify(execFile)(process.execPath,['--import','tsx','scripts/google/agente.mts','consultar','--pedido',pedido,'--pasta',pasta],{env,timeout:20000})
    expect(JSON.parse(stdout)).toMatchObject({execucao:{pedido_id:pedido,entregues:4}})
    expect(comandos).toEqual([{acao:'consultar',pedido,executor}])
    expect(JSON.parse(await readFile(join(pasta,'publicacao-pendente.json'),'utf8')).pedido).toBe(pedido)
  }finally{await new Promise<void>(r=>servidor.close(()=>r()));await rm(pasta,{recursive:true,force:true})}
},25000)