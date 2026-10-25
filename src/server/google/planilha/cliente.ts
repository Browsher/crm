import { sign } from 'node:crypto'
import { criarClientePlanilhaN8n } from './cliente-n8n'
import type { ConfiguracaoPlanilha } from './configuracao'
import { normalizarCriterios } from '@/src/lib/google/criterios'

export const CABECALHO_LEGADO = ['Pedido ID','Revisão','Vendedor ID','Vendedor','Data','Dia da semana','Nicho','Bairro','Cidade','UF','Situação','Atualizado em','Versão']
export const CABECALHO_PLANILHA = [...CABECALHO_LEGADO, 'Critérios de busca']
export type PayloadPlanilha = { pedido: string; linha: number; versao: number; revisao: number; contrato?: 1|2; envio_id?: string|null; anteriores: string[][]; dados: {
  id: string; vendedor_id: string; vendedor: string; dia: string; nicho: string; bairro: string; cidade: string; uf: string; estado: string; atualizado_em: string; criterios?: unknown } }
const objeto = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const conferir = () => new Error('Planilha precisa de conferência. Preserve a mesma revisão antes de tentar novamente.')
const incerto = () => new Error('Gravação não confirmada. Reconcilie a mesma revisão antes de continuar.')
export function celulasDoPedido(p: PayloadPlanilha): string[] {
  const d = p.dados
  const semana = new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'}).format(new Date(d.dia+'T12:00:00Z'))
  const celulas = [p.pedido,String(p.revisao),d.vendedor_id,d.vendedor,d.dia,semana,d.nicho,d.bairro,d.cidade,d.uf,d.estado,d.atualizado_em,String(p.versao)]
  if (d.criterios === undefined) {
    if (p.contrato === 2) throw conferir()
    return celulas
  }
  const criterios = normalizarCriterios(d.criterios)
  if (!criterios.ok) throw conferir()
  return [...celulas, JSON.stringify(criterios.valor)]
}
async function lerJson(r: Response): Promise<Record<string, unknown>> {
  if (!r.ok || Number(r.headers.get('content-length')) > 256000 || !r.body) throw incerto()
  const reader = r.body.getReader()
  const partes: Uint8Array[] = []
  let tamanho = 0
  try {
    while (true) {
      const {done,value} = await reader.read()
      if (done) break
      tamanho += value.byteLength
      if (tamanho > 256000) { await reader.cancel(); throw incerto() }
      partes.push(value)
    }
    const valor: unknown = JSON.parse(Buffer.concat(partes).toString('utf8'))
    if (!objeto(valor)) throw incerto()
    return valor
  } finally { reader.releaseLock() }
}
function linhas(v: Record<string, unknown>): string[][] {
  if (v.values === undefined) return []
  if (!Array.isArray(v.values) || !v.values.every(l => Array.isArray(l) && l.every(c => typeof c === 'string'))) throw conferir()
  return v.values as string[][]
}
export function criarClientePlanilha(config: ConfiguracaoPlanilha, fetcher: typeof fetch = fetch) {
  if ('transporte' in config) return criarClientePlanilhaN8n(config,celulasDoPedido,fetcher)
  return {
    async conectar() {
      let token: string
      let expira: number
      try {
        const agora = Math.floor(Date.now()/1000)
        const codificar = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
        const jwt = codificar({alg:'RS256',typ:'JWT'})+'.'+codificar({iss:config.email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:agora,exp:agora+3600})
        const assertion = jwt+'.'+sign('RSA-SHA256',Buffer.from(jwt),config.chave).toString('base64url')
        const r = await lerJson(await fetcher('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
          headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})}))
        if (typeof r.access_token !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(r.access_token) || r.token_type !== 'Bearer'
          || typeof r.expires_in !== 'number' || r.expires_in<=0 || r.expires_in>3600) throw incerto()
        token = r.access_token
        expira = Date.now()+r.expires_in*1000
      } catch { throw incerto() }
      return {
        async gravar(p: PayloadPlanilha, operacao = {incerta:false}) {
          if (!Number.isInteger(p.linha) || p.linha<2 || p.linha>200000 || expira<=Date.now()) throw conferir()
          const signal = AbortSignal.timeout(18000)
          const base = 'https://sheets.googleapis.com/v4/spreadsheets/'+config.planilhaId
          const req = async (url: string, init: RequestInit = {}) => {
            try {
              const mutacao = init.method === 'PUT' || init.method === 'POST'
              if (mutacao) operacao.incerta = true
              const resposta = await fetcher(url,{...init,redirect:'error',signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}})
              if (mutacao) operacao.incerta = false
              return await lerJson(resposta)
            } catch { throw incerto() }
          }
          const meta = await req(base+'?fields=spreadsheetId,sheets(properties(sheetId,title,gridProperties))')
          if (meta.spreadsheetId !== config.planilhaId || !Array.isArray(meta.sheets)) throw conferir()
          const aba = meta.sheets.find(s => objeto(s) && objeto(s.properties) && s.properties.sheetId===config.abaId)
          if (!objeto(aba) || !objeto(aba.properties) || aba.properties.title !== 'Planejamento CRM' || !objeto(aba.properties.gridProperties)) throw conferir()
          const grade = aba.properties.gridProperties
          const novo = p.dados.criterios !== undefined
          if (typeof grade.rowCount !== 'number' || typeof grade.columnCount !== 'number' || grade.columnCount<(novo ? 14 : 13)) throw conferir()
          const valores = (a1: string) => base+'/values/'+encodeURIComponent("'Planejamento CRM'!"+a1)
          const header = linhas(await req(valores(novo ? 'A1:N1' : 'A1:M1')+'?valueRenderOption=UNFORMATTED_VALUE'))
          if (!igual(header,[novo ? CABECALHO_PLANILHA : CABECALHO_LEGADO])) throw conferir()
          if (grade.rowCount<p.linha) await req(base+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{appendDimension:{sheetId:config.abaId,dimension:'ROWS',length:p.linha-grade.rowCount}}]})})
          const intervalo = 'A'+p.linha+(novo ? ':N' : ':M')+p.linha
          const atual = celulasDoPedido(p)
          const encontradas = linhas(await req(valores(intervalo)+'?valueRenderOption=UNFORMATTED_VALUE'))
          if (encontradas.length>1) throw conferir()
          const existente = encontradas[0] ?? []
          if (igual(existente,atual)) return
          if (existente.some(c => c !== '') && !p.anteriores.some(l => igual(l,existente))) throw conferir()
          await req(valores(intervalo)+'?valueInputOption=RAW',{method:'PUT',body:JSON.stringify({range:"'Planejamento CRM'!"+intervalo,majorDimension:'ROWS',values:[atual]})})
          const retorno = linhas(await req(valores(intervalo)+'?valueRenderOption=UNFORMATTED_VALUE'))
          if (!igual(retorno,[atual])) throw conferir()
        },
      }
    },
  }
}
