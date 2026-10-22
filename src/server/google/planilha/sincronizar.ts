import { comoUsuario } from '@/src/server/db/como-usuario'
import { configuracaoPlanilha, type ConfiguracaoPlanilha } from './configuracao'
import { celulasDoPedido, criarClientePlanilha, type PayloadPlanilha } from './cliente'

export type ResultadoSincronizacao = { estado: 'sincronizado' } | { estado: 'pendente'; motivo: string }
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const pendente = (): ResultadoSincronizacao => ({estado:'pendente',motivo:'Salvo no CRM. A sincronização precisa ser conferida pelo gestor.'})
export async function sincronizarCom(pedidoId: string, {config,gestorId,fetcher}: {config: ConfiguracaoPlanilha; gestorId: string; fetcher?: typeof fetch}): Promise<ResultadoSincronizacao> {
  if (!UUID.test(pedidoId) || !UUID.test(gestorId)) return pendente()
  const destino = config.planilhaId+':'+config.abaId
  try {
    const intencao = await comoUsuario(gestorId,async e => {
      const p = (await e<{p:PayloadPlanilha}>('SELECT google_planilha_preparar($1,$2) AS p',[pedidoId,destino])).linhas[0].p
      const {linhas} = await e<{ok:boolean}>('SELECT google_planilha_intencao($1,$2,$3) AS ok',[pedidoId,p.versao,JSON.stringify(celulasDoPedido(p))])
      if (!linhas[0].ok) throw new Error('Revisão alterada')
      return p
    })
    let cliente: Awaited<ReturnType<ReturnType<typeof criarClientePlanilha>['conectar']>>
    try { cliente = await criarClientePlanilha(config,fetcher).conectar() }
    catch {
      await comoUsuario(gestorId,e => e('SELECT google_planilha_confirmar($1,$2,$3)',[pedidoId,intencao.versao,'Conexão da planilha não confirmada. Verifique a configuração.']))
      return pendente()
    }
    return await comoUsuario(gestorId,async e => {
      const p = (await e<{p:PayloadPlanilha}>('SELECT google_planilha_preparar($1,$2) AS p',[pedidoId,destino])).linhas[0].p
      if (p.versao !== intencao.versao) return pendente()
      try {
        await cliente.gravar(p)
        const {linhas} = await e<{ok:boolean}>('SELECT google_planilha_confirmar($1,$2,NULL) AS ok',[pedidoId,p.versao])
        return linhas[0].ok ? {estado:'sincronizado'} : pendente()
      } catch {
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
