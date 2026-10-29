import type { ConfiguracaoPlanilhaN8n } from './configuracao'
import type { PayloadPlanilha } from './cliente'

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const linhaValida = (v: unknown, pedido: string): v is string[] => Array.isArray(v)
  && (v.length === 13 || v.length === 14) && v.every(c => typeof c === 'string') && v[0] === pedido
const incerto = () => new Error('Gravação não confirmada. Reconcilie a mesma revisão antes de continuar.')

async function lerLimitado(resposta: Response): Promise<unknown> {
  if (!resposta.ok || !resposta.body || Number(resposta.headers.get('content-length')) > 256000) throw incerto()
  const reader = resposta.body.getReader()
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
    return JSON.parse(Buffer.concat(partes).toString('utf8'))
  } finally { reader.releaseLock() }
}

export function criarClientePlanilhaN8n(config: ConfiguracaoPlanilhaN8n, montar: (p: PayloadPlanilha) => string[], fetcher: typeof fetch) {
  return {
    async conectar() {
      return {
        async gravar(p: PayloadPlanilha, operacao = {incerta:false}) {
          if (!UUID.test(p.pedido) || !p.envio_id || !UUID.test(p.envio_id)
            || !Number.isInteger(p.linha) || p.linha < 2 || p.linha > 200000
            || !Number.isSafeInteger(p.revisao) || p.revisao < 1 || !Number.isSafeInteger(p.versao) || p.versao < 1) {
            throw new Error('Planilha precisa de conferência. Nenhum envio foi iniciado.')
          }
          const celulas = montar(p)
          if (!linhaValida(celulas,p.pedido) || celulas[1] !== String(p.revisao) || celulas[12] !== String(p.versao)
            || !Array.isArray(p.anteriores) || !p.anteriores.every(a => linhaValida(a,p.pedido))) {
            throw new Error('Planilha precisa de conferência. Nenhum envio foi iniciado.')
          }
          const identidade = {protocolo:1,planilha_id:config.planilhaId,aba_id:config.abaId,pedido_id:p.pedido,
            envio_id:p.envio_id,linha:p.linha,revisao:p.revisao,versao:p.versao}
          const corpo = JSON.stringify({...identidade,operacao:'sincronizar',celulas,anteriores:p.anteriores})
          if (Buffer.byteLength(corpo,'utf8') > 128000) throw new Error('Planilha precisa de conferência. Nenhum envio foi iniciado.')
          operacao.incerta = true
          try {
            const r = await lerLimitado(await fetcher(config.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(18000),
              headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:corpo}))
            if (!r || typeof r !== 'object' || Array.isArray(r)) throw incerto()
            const recibo = r as Record<string,unknown>
            if (recibo.estado !== 'sincronizado' || !Object.entries(identidade).every(([k,v]) => recibo[k] === v)
              || JSON.stringify(recibo.celulas) !== JSON.stringify(celulas)) throw incerto()
            operacao.incerta = false
          } catch { throw incerto() }
        },
      }
    },
  }
}
