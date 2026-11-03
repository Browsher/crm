import type { AlvoVenda } from '../../lib/venda-envio'
import type { LeituraDestino } from '../../lib/pos-registro'
import { comoUsuario } from '../db/como-usuario'
// Chamar somente após RPC confirmada. A negociação pode estar encerrada.
// O vínculo atual e a venda sob RLS autorizam o destino; storage não o escolhe.
export async function lerDestinoVenda(usuarioId:string,chave:string,alvo:AlvoVenda):Promise<LeituraDestino<{tipo:'carteira';empresaId:string}>> {
  try {
    const empresaId=await comoUsuario(usuarioId,async executar=>{
      const {linhas}=await executar<{empresa_id:string}>(`SELECT v.empresa_id FROM venda v
        JOIN empresa_vinculo ev ON ev.empresa_id=v.empresa_id
        WHERE v.chave=$1 AND v.autor_id=$2 AND ev.vendedor_id=$2
          AND v.negociacao_id IS NOT DISTINCT FROM $3::uuid`,[chave,usuarioId,alvo.tipo==='primeira'?alvo.negociacaoId:null])
      return linhas[0]?.empresa_id
    })
    return empresaId?{ok:true,destino:{tipo:'carteira',empresaId}}:{ok:false,motivo:'leitura_indisponivel'}
  } catch {return {ok:false,motivo:'leitura_indisponivel'}}
}
