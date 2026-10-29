const banco=new URL(process.env.DATABASE_URL||'postgres://invalido/invalido')
const mock=new URL(process.env.GOOGLE_PLANILHA_MOCK_URL||'http://invalido')
if(process.env.CRM_E2E!=='1' || process.env.ALVO || banco.username!=='app_teste'
  || !['localhost','127.0.0.1','[::1]'].includes(banco.hostname) || !/^\/teste_[0-9a-f]{12}$/.test(banco.pathname) || banco.search
  || mock.protocol!=='http:' || mock.hostname!=='127.0.0.1' || !mock.port || mock.username || mock.password || mock.pathname!=='/' || mock.search || mock.hash
  || process.env.GOOGLE_PLANILHA_ID!=='planilha-somente-e2e' || process.env.GOOGLE_PLANILHA_ABA_ID!=='123'
  || process.env.GOOGLE_PLANILHA_CLIENT_EMAIL!=='sheets-e2e@crm-test.iam.gserviceaccount.com') throw new Error('Ambiente de simulação Sheets inválido')
const original=globalThis.fetch
globalThis.fetch=(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input))
  if(!['sheets.googleapis.com','oauth2.googleapis.com'].includes(url.hostname)) return original(input,init)
  const permitido=url.origin==='https://oauth2.googleapis.com'?url.pathname==='/token':
    url.origin==='https://sheets.googleapis.com' && /^\/v4\/spreadsheets\/planilha-somente-e2e(?:\/values\/[^?]+|:batchUpdate)?$/.test(url.pathname)
  if(!permitido) return Promise.reject(new Error('Rota Google fora da simulação'))
  const destino=new URL(url.pathname+url.search,mock)
  return original(input instanceof Request?new Request(destino,input):destino,init)
}
