import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
import { criteriosVazios, type CriteriosGoogle } from '@/src/lib/google/criterios'
import { avaliarEntrega } from '@/src/lib/google/entrega'
import { conferirRetornoVerificacoes } from './cliente'

type No = { name: string; type: string; parameters: { jsCode?: string; conditions?: {conditions: {leftValue:string}[]}; responseBody?:string; numbers?:string } }
type Grafo = {nodes:No[];connections:Record<string,{main:{node:string}[][]}>}
const base = {pedido_id:'00000000-0000-4000-8000-000000000001',execucao_id:'00000000-0000-4000-8000-000000000002',lote_id:'00000000-0000-4000-8000-000000000003',revisao:1,snapshot_sha256:'a'.repeat(64)}
async function executar(criterios: CriteriosGoogle, candidatas: Record<string,unknown>[], retorno?: unknown, alterar?: Record<string,unknown>, conectado=true, identidade=base, aoConsultar?: () => void) {
  const w: Grafo = JSON.parse(await readFile('workflows/n8n/google/verificar-empresas.json','utf8'))
  let nome = 'Validar pedido'
  let entrada: {json:Record<string,unknown>}[] = [{json:{body:{...identidade,criterios,candidatas,verificacoes_requeridas:[],...alterar}}}]
  const memoria = new Map<string, typeof entrada>()
  const chamadas: unknown[] = []
  for(let i=0;i<40;i++) {
    const n = w.nodes.find(n=>n.name===nome)!
    const ctx = {$json:entrada[0].json,$input:{first:()=>entrada[0],all:()=>entrada},$:(nome:string)=>({first:()=>memoria.get(nome)![0]}),URL:undefined,Date,JSON,
      $env:new Proxy({}, {get(){throw new Error('Credenciais devem ficar no n8n')}})}
    const avaliar = (codigo:string) => runInNewContext(codigo,ctx)
    let ramo=0
    if(n.type==='n8n-nodes-base.code') entrada=avaliar('(function(){'+n.parameters.jsCode+'})()')
    else if(n.type==='n8n-nodes-base.if') ramo=avaliar(n.parameters.conditions!.conditions[0].leftValue.replace(/^=\{\{\s*|\s*\}\}$/g,''))?0:1
    else if(n.type==='n8n-nodes-evolution-api.evolutionApi') {
      chamadas.push(avaliar(n.parameters.numbers!.replace(/^=\{\{\s*|\s*\}\}$/g,'')))
      aoConsultar?.()
      entrada=[{json:await Promise.resolve(retorno) as Record<string,unknown>}]
    } else if(n.name==='Consultar conexão Evolution') entrada=[{json:{statusCode:200,body:{instance:{state:conectado?'open':'close'}}}}]
    else if(n.type==='n8n-nodes-base.respondToWebhook') {
      const dados=JSON.parse(avaliar(n.parameters.responseBody!.replace(/^=\{\{\s*|\s*\}\}$/g,'')))
      return {dados,chamadas,conferido:conferirRetornoVerificacoes({...identidade,criterios},candidatas,dados)}
    } else throw new Error('Chamada externa indevida: '+n.name)
    memoria.set(nome,entrada)
    nome=w.connections[nome].main[ramo][0].node
  }
  throw new Error('Grafo sem resposta')
}
test('recalcula verificações do snapshot e combina site, email, Google E (WhatsApp OU fixo)',async()=>{
 const c={...criteriosVazios(),site:['com'],email:['com'],telefone:['whatsapp','fixo'],nota:4,avaliacoes:10} as CriteriosGoogle
 const candidatas=[{google_place_id:'A',telefone:'1133334444',site:'https://loja.example.org',email:'vendas@loja.example.org',dados_brutos:{review_rating:'4.5',review_count:'12'}},
 {google_place_id:'B',telefone:'11999998888',site:'https://loja.example.org',email:'vendas@loja.example.org',dados_brutos:{review_rating:'3.0',review_count:'20'}}]
 const r=await executar(c,candidatas,{success:true,data:[{number:'551133334444',exists:false},{number:'5511999998888',exists:true}]})
 expect(r.chamadas).toEqual(['551133334444,5511999998888'])
 expect(avaliarEntrega(c,r.conferido.evidencias.filter(e=>e.candidata==='A')).estado).toBe('aprovado')
 expect(avaliarEntrega(c,r.conferido.evidencias.filter(e=>e.candidata==='B')).estado).toBe('reprovado')
})
test('perfil sem qualificador e ausência de email/site são não confirmados sem impedir fixo',async()=>{
 const c={...criteriosVazios(),produtos:'brinquedos',tipos:['varejista'],site:['sem'],email:['sem'],telefone:['fixo']} as CriteriosGoogle
 const r=await executar(c,[{google_place_id:'A',telefone:'1133334444'}])
 expect(r.chamadas).toEqual([])
 expect(r.conferido.evidencias.filter(e=>e.estado==='nao_confirmado').map(e=>e.criterio).sort()).toEqual(['email','produtos','site','tipos'])
 expect(r.conferido.evidencias.find(e=>e.criterio==='telefone')?.estado).toBe('aprovado')
 expect(avaliarEntrega(c,r.conferido.evidencias).estado).toBe('nao_confirmado')
})
test('opções neutras não chamam Evolution nem qualificador',async()=>{
 const c={...criteriosVazios(),site:['com','sem'],email:['com','sem']} as CriteriosGoogle
 const r=await executar(c,[{google_place_id:'A'}])
 expect(r.chamadas).toEqual([])
 expect(r.conferido.evidencias).toEqual([])
})
test.each(['https://wa.me/5511999998888','https://maps.app.goo.gl/abc','https://instagram.com/loja','https://user:senha@site.example.org'])('link %s não comprova site próprio',async site=>{
 const r=await executar({...criteriosVazios(),site:['com']},[{google_place_id:'A',site}])
 expect(r.conferido.evidencias[0].estado).toBe('nao_confirmado')
})
test.each([{success:false,error:'offline',data:[{number:'5511999998888',exists:true}]},
 {success:true,data:[{number:'5511999998888',exists:true},{number:'5511999998888',exists:false}]}])('Evolution inválido não libera empresa',async retorno=>{
 await expect(executar({...criteriosVazios(),telefone:['whatsapp']},[{google_place_id:'A',telefone:'11999998888'}],retorno)).rejects.toThrow()
})
test('resposta sem o número exato fica não confirmada',async()=>{
 const r=await executar({...criteriosVazios(),telefone:['whatsapp']},[{google_place_id:'A',telefone:'11999998888'}],{success:true,data:[{number:'551188888888',exists:true}]})
 expect(r.conferido.evidencias[0].estado).toBe('nao_confirmado')
})
test.each([{revisao:0},{snapshot_sha256:'x'},{candidatas:[{google_place_id:'A'},{google_place_id:'A'}]}])('identidade divergente é recusada antes de consultar',async alterar=>{
 await expect(executar(criteriosVazios(),[{google_place_id:'A'}],undefined,alterar)).rejects.toThrow()
})

test('instância desconectada impede consulta e aprovação',async()=>{
 await expect(executar({...criteriosVazios(),telefone:['whatsapp']},[{google_place_id:'A',telefone:'11999998888'}],{success:true,data:[{number:'5511999998888',exists:true}]},undefined,false)).rejects.toThrow('desconectada')
})


test('tres contextos simultaneos retornam fora de ordem sem misturar evidencias', async () => {
  const criar = () => { let liberar!: (v: unknown) => void; const promessa = new Promise<unknown>(r => { liberar = r }); return { promessa, liberar } }
  const respostas = [criar(), criar(), criar()]
  const identidades = [0, 1, 2].map(i => ({ ...base, pedido_id: '00000000-0000-4000-8000-00000000001'+i, execucao_id: '00000000-0000-4000-8000-00000000002'+i, lote_id: '00000000-0000-4000-8000-00000000003'+i, revisao: i+1, snapshot_sha256: String(i+1).repeat(64) }))
  let avisar!: () => void, entradas = 0
  const tres = new Promise<void>(r => { avisar = r })
  const criterio = { ...criteriosVazios(), telefone: ['whatsapp'] } as CriteriosGoogle
  const tarefas = identidades.map((id, i) => executar(criterio, [{ google_place_id: 'place-'+i, telefone: '1199999888'+i }], respostas[i].promessa, undefined, true, id, () => { if (++entradas === 3) avisar() }))
  const resultados = Promise.allSettled(tarefas)
  await tres
  respostas[2].liberar({ success: true, data: [{ number: '5511999998882', exists: true }] })
  respostas[1].liberar({ success: false, error: 'fixture' })
  respostas[0].liberar({ success: true, data: [{ number: '5511999998880', exists: false }] })
  const r = await resultados
  expect(r[1].status).toBe('rejected')
  for (const i of [0, 2]) {
    expect(r[i].status).toBe('fulfilled')
    if (r[i].status === 'fulfilled') {
      expect(r[i].value.dados).toMatchObject(identidades[i])
      expect(r[i].value.conferido.evidencias[0].candidata).toBe('place-'+i)
    }
  }
})
