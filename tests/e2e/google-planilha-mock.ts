import { generateKeyPairSync, verify } from 'node:crypto'
import { createServer } from 'node:http'

const header=['Pedido ID','Revisão','Vendedor ID','Vendedor','Data','Dia da semana','Nicho','Bairro','Cidade','UF','Situação','Atualizado em','Versão','Critérios de busca']
export async function iniciarSheetsDeTeste() {
  const chaves=generateKeyPairSync('rsa',{modulusLength:2048})
  const email='sheets-e2e@crm-test.iam.gserviceaccount.com'
  const linhas=new Map<string,string[]>()
  let falhar=false
  const servidor=createServer(async(req,res)=>{
    try {
      const u=new URL(req.url??'/','http://127.0.0.1')
      const partes: Buffer[]=[]
      let bytes=0
      for await(const parte of req) {
        bytes+=parte.length
        if(bytes>64000) throw new Error('Corpo excessivo')
        partes.push(Buffer.from(parte))
      }
      const texto=Buffer.concat(partes).toString()
      const responder=(valor:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(valor))}
      if(u.pathname==='/__controle') { responder({linhas:[...linhas.values()]});return }
      if(u.pathname==='/__falhar' && req.method==='POST') { falhar=true;responder({ok:true});return }
      if(u.pathname==='/token' && req.method==='POST') {
        const params=new URLSearchParams(texto)
        const [h,c,s]=(params.get('assertion')??'').split('.')
        if(params.get('grant_type')!=='urn:ietf:params:oauth:grant-type:jwt-bearer' || !h || !c || !s
          || !verify('RSA-SHA256',Buffer.from(h+'.'+c),chaves.publicKey,Buffer.from(s,'base64url'))
          || JSON.parse(Buffer.from(c,'base64url').toString()).iss!==email) {responder({erro:'Credencial fictícia inválida'},401);return}
        responder({access_token:'sheets-token-e2e',token_type:'Bearer',expires_in:3600});return
      }
      if(req.headers.authorization!=='Bearer sheets-token-e2e') {responder({erro:'Token fictício inválido'},401);return}
      if(u.pathname==='/v4/spreadsheets/planilha-somente-e2e') {
        responder({spreadsheetId:'planilha-somente-e2e',sheets:[{properties:{sheetId:123,title:'Planejamento CRM',gridProperties:{rowCount:200000,columnCount:14}}}]});return
      }
      const prefixo='/v4/spreadsheets/planilha-somente-e2e/values/'
      if(!u.pathname.startsWith(prefixo)) {responder({erro:'Rota fictícia não permitida'},404);return}
      const range=decodeURIComponent(u.pathname.slice(prefixo.length))
      if(range==="'Planejamento CRM'!A1:M1" && req.method==='GET') {responder({values:[header.slice(0,13)]});return}
      if(range==="'Planejamento CRM'!A1:N1" && req.method==='GET') {responder({values:[header]});return}
      if(!/^'Planejamento CRM'!A([0-9]+):[MN]\1$/.test(range)) {responder({erro:'Faixa inválida'},400);return}
      if(req.method==='PUT') {
        const dados=JSON.parse(texto)
        if(u.searchParams.get('valueInputOption')!=='RAW' || dados.values?.length!==1 || dados.values[0].length!==(range.includes(':N')?14:13)) {responder({erro:'Matriz inválida'},400);return}
        linhas.set(range,dados.values[0])
        if(falhar) {falhar=false;responder({erro:'Resposta perdida após gravação fictícia'},503);return}
        responder({updatedRows:1});return
      }
      responder({values:linhas.has(range)?[linhas.get(range)]:[]})
    } catch {res.writeHead(400,{'Content-Type':'application/json'});res.end('{"erro":"Requisição fictícia inválida"}')}
  })
  await new Promise<void>(resolve=>servidor.listen(0,'127.0.0.1',resolve))
  const endereco=servidor.address()
  if(!endereco || typeof endereco==='string') throw new Error('Sheets fictício indisponível')
  return {url:'http://127.0.0.1:'+endereco.port,chave:chaves.privateKey.export({type:'pkcs8',format:'pem'}).toString(),email,
    fechar:()=>new Promise<void>((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()))}
}
