import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
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
