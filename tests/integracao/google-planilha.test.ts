import { generateKeyPairSync } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { sincronizarCom } from '@/src/server/google/planilha/sincronizar'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let dia: string
const chave = generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'}).toString()
const config = {planilhaId:'fixture-planilha',abaId:123,email:'robot@projeto.iam.gserviceaccount.com',chave}
const header = ['Pedido ID','Revisão','Vendedor ID','Vendedor','Data','Dia da semana','Nicho','Bairro','Cidade','UF','Situação','Atualizado em','Versão']
function fakeGoogle(falhar = false, antesDeEscrever?: () => Promise<void>) {
  const linhas = new Map<string,string[]>()
  let escritas = 0
  const fetcher: typeof fetch = async (input,init) => {
    const u = new URL(String(input))
    if (u.hostname==='oauth2.googleapis.com') return Response.json({access_token:'fake',token_type:'Bearer',expires_in:3600})
    if (!u.pathname.includes('/values/')) return Response.json({spreadsheetId:config.planilhaId,sheets:[{properties:{sheetId:123,title:'Planejamento CRM',gridProperties:{rowCount:10000,columnCount:13}}}]})
    const range = decodeURIComponent(u.pathname.split('/values/')[1])
    if (range.endsWith('A1:M1')) return Response.json({values:[header]})
    if (init?.method==='PUT') {
      await antesDeEscrever?.()
      linhas.set(range,JSON.parse(String(init.body)).values[0])
      escritas++
      if (falhar) { falhar=false; return Response.json({error:'Resposta concluída sem confirmação'}, {status:503}) }
    }
    return Response.json({values:linhas.has(range)?[linhas.get(range)]:[]})
  }
  return {fetcher,linhas,escritas:()=>escritas}
}
const planejar = async (nicho: string) => banco.comoUsuario(vendedor,async e => (await e<{id:string}>("SELECT google_planejar($1,$2,'','São Paulo','SP') AS id",[dia,nicho])).linhas[0].id)
beforeAll(async () => {
  banco=await criarBancoDeTeste()
  gestor=await criarUsuario(banco,'gestor','EspelhoGestor')
  vendedor=await criarUsuario(banco,'vendedor','EspelhoVendedor')
  dia=(await banco.sql<{dia:string}>("SELECT to_char(date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')+interval '7 days','YYYY-MM-DD') AS dia"))[0].dia
})
afterAll(async () => { await banco?.derrubar() })

test('PUT com transporte perdido impede revisão posterior mesmo se a escrita antiga terminar atrasada',async () => {
  const [d]=await banco.sql<{dia:string}>("SELECT to_char($1::date+1,'YYYY-MM-DD') AS dia",[dia])
  const salvar=(nicho:string)=>banco.comoUsuario(vendedor,async e=>(await e<{id:string}>("SELECT google_planejar($1,$2,'','São Paulo','SP') AS id",[d.dia,nicho])).linhas[0].id)
  const id=await salvar('Critérios antigos')
  const fake=fakeGoogle()
  let tardia: (()=>Promise<Response>)|undefined
  let puts=0
  const fetcher:typeof fetch=async(input,init)=>{
    if(init?.method==='PUT') {
      puts++
      if(puts===1) { tardia=()=>fake.fetcher(input,init); throw new Error('Conexão perdida antes da aplicação') }
    }
    return fake.fetcher(input,init)
  }
  expect(await sincronizarCom(id,{config,gestorId:gestor,fetcher})).toMatchObject({estado:'pendente'})
  await salvar('Critérios novos')
  const resultado=await sincronizarCom(id,{config,gestorId:gestor,fetcher})
  await tardia!()
  expect(resultado).toMatchObject({estado:'pendente'})
  expect(puts).toBe(1)
  expect((await banco.sql<{revisao_confirmada:number}>('SELECT revisao_confirmada FROM google_sincronizacao WHERE pedido_id=$1',[id]))[0].revisao_confirmada).toBe(0)
  expect([...fake.linhas.values()][0][6]).toBe('Critérios antigos')
})
test('sincroniza pelo serviço real e registra confirmação da revisão exata',async () => {
  const id=await planejar('Papelarias')
  const fake=fakeGoogle()
  expect(await sincronizarCom(id,{config,gestorId:gestor,fetcher:fake.fetcher})).toEqual({estado:'sincronizado'})
  const [p]=await banco.sql<{revisao:number;revisao_confirmada:number;erro:string|null}>('SELECT revisao,revisao_confirmada,erro FROM google_sincronizacao WHERE pedido_id=$1',[id])
  expect(p).toEqual({revisao:1,revisao_confirmada:1,erro:null})
  expect([...fake.linhas.values()][0][6]).toBe('Papelarias')
})
test('escrita incerta mantém intenção e destino, e a retomada não duplica a linha',async () => {
  const id=await planejar('Brinquedos')
  const fake=fakeGoogle(true)
  expect(await sincronizarCom(id,{config,gestorId:gestor,fetcher:fake.fetcher})).toMatchObject({estado:'pendente'})
  expect((await banco.sql<{destino:string;erro:string|null}>('SELECT destino,erro FROM google_sincronizacao WHERE pedido_id=$1',[id]))[0]).toMatchObject({destino:'fixture-planilha:123',erro:expect.any(String)})
  expect(await sincronizarCom(id,{config,gestorId:gestor,fetcher:fake.fetcher})).toEqual({estado:'sincronizado'})
  expect(fake.linhas.size).toBe(1)
  expect(fake.escritas()).toBe(1)
})
test('destino divergente não recebe critérios e outra revisão atualiza somente a linha vinculada',async () => {
  const id=await planejar('Pet shops')
  const fake=fakeGoogle()
  expect(await sincronizarCom(id,{config:{...config,planilhaId:'outro-arquivo'},gestorId:gestor,fetcher:fake.fetcher})).toMatchObject({estado:'pendente'})
  expect(fake.escritas()).toBe(0)
  expect(await sincronizarCom(id,{config,gestorId:gestor,fetcher:fake.fetcher})).toEqual({estado:'sincronizado'})
  expect([...fake.linhas.values()][0][6]).toBe('Pet shops')
})
test('edição concorrente espera a escrita em andamento e a última revisão prevalece',async () => {
  const id=await planejar('Primeira edição')
  let liberar!: () => void
  let entrou!: () => void
  const bloqueio=new Promise<void>(r=>{liberar=r})
  const chegada=new Promise<void>(r=>{entrou=r})
  const fake=fakeGoogle(false,async()=>{entrou();await bloqueio})
  const escrita=sincronizarCom(id,{config,gestorId:gestor,fetcher:fake.fetcher})
  await chegada
  const edicao=planejar('Última edição')
  try {
    await expect.poll(async()=>(await banco.sql<{n:number}>("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND query LIKE 'SELECT google_planejar(%' AND wait_event_type='Lock'"))[0].n).toBe(1)
  } finally { liberar(); await Promise.allSettled([escrita,edicao]) }
  expect(await sincronizarCom(id,{config,gestorId:gestor,fetcher:fake.fetcher})).toEqual({estado:'sincronizado'})
  expect([...fake.linhas.values()][0][6]).toBe('Última edição')
})
