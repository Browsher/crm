import { comoUsuario } from '@/src/server/db/como-usuario'
import { randomUUID } from 'node:crypto'
import { configuracaoPlanilha, type ConfiguracaoPlanilha } from './configuracao'
import { celulasDoPedido, criarClientePlanilha, type PayloadPlanilha } from './cliente'

export type ResultadoSincronizacao = { estado: 'sincronizado' } | { estado: 'pendente'; motivo: string }
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const pendente = (): ResultadoSincronizacao => ({estado:'pendente',motivo:'Salvo no CRM. A sincronização precisa ser conferida pelo gestor.'})
export async function sincronizarCom(pedidoId: string, {config,gestorId,fetcher}: {config: ConfiguracaoPlanilha; gestorId: string; fetcher?: typeof fetch}): Promise<ResultadoSincronizacao> {
  if (!UUID.test(pedidoId) || !UUID.test(gestorId)) return pendente()
  const destino = config.planilhaId+':'+config.abaId
  const envio = randomUUID()
  try {
    const intencao = await comoUsuario(gestorId,async e => {
      const p = (await e<{p:PayloadPlanilha}>('SELECT google_planilha_preparar($1,$2) AS p',[pedidoId,destino])).linhas[0].p
      if (p.envio_id) return null
      const {linhas} = await e<{ok:boolean}>('SELECT google_planilha_intencao($1,$2,$3,$4) AS ok',[pedidoId,p.versao,JSON.stringify(celulasDoPedido(p)),envio])
      if (!linhas[0].ok) throw new Error('Revisão alterada')
      return p
    })
    if (!intencao) return pendente()
    let cliente: Awaited<ReturnType<ReturnType<typeof criarClientePlanilha>['conectar']>>
    try { cliente = await criarClientePlanilha(config,fetcher).conectar() }
    catch {
      await comoUsuario(gestorId,async e => {
        await e('SELECT google_planilha_liberar($1,$2)',[pedidoId,envio])
        await e('SELECT google_planilha_confirmar($1,$2,$3)',[pedidoId,intencao.versao,'Conexão da planilha não confirmada. Verifique a configuração.'])
      })
      return pendente()
    }
    return await comoUsuario(gestorId,async e => {
      const p = (await e<{p:PayloadPlanilha}>('SELECT google_planilha_preparar($1,$2) AS p',[pedidoId,destino])).linhas[0].p
      if (p.envio_id !== envio) return pendente()
      if (p.versao !== intencao.versao) {
        await e('SELECT google_planilha_liberar($1,$2)',[pedidoId,envio])
        return pendente()
      }
      const operacao = {incerta:false}
      try {
        await cliente.gravar(p,operacao)
        await e('SELECT google_planilha_liberar($1,$2)',[pedidoId,envio])
        const {linhas} = await e<{ok:boolean}>('SELECT google_planilha_confirmar($1,$2,NULL) AS ok',[pedidoId,p.versao])
        return linhas[0].ok ? {estado:'sincronizado'} : pendente()
      } catch {
        if (!operacao.incerta) await e('SELECT google_planilha_liberar($1,$2)',[pedidoId,envio])
        await e('SELECT google_planilha_confirmar($1,$2,$3)',[pedidoId,p.versao,'Planilha não confirmada. Confira conexão, aba e divergências antes de retomar.'])
        return pendente()
      }
    })
  } catch { return pendente() }
}
export async function sincronizarPedido(pedidoId: string): Promise<ResultadoSincronizacao> {
  const config = configuracaoPlanilha()
  const gestorId = process.env.GOOGLE_AGENTE_USUARIO_ID
  if (!config || !gestorId) return {estado:'pendente',motivo:'Salvo no CRM. A conexão com a planilha ainda precisa ser configurada pelo gestor.'}
  return sincronizarCom(pedidoId,{config,gestorId})
}
