import { comoUsuario } from '../../server/db/como-usuario'
import { UUID, type DadosVenda } from '../../lib/venda'
export type ResultadoVenda = {ok:true} | {ok:false;motivo:'sem_permissao'|'nao_cliente'|'dados_invalidos'|'chave_reutilizada'}
export async function registrarVenda(usuarioId:string,empresaId:string,dados:DadosVenda):Promise<ResultadoVenda> {
  if(!UUID.test(empresaId))return {ok:false,motivo:'sem_permissao'}
  return comoUsuario(usuarioId,async executar=>{
    const {linhas}=await executar<{resultado:string}>('SELECT carteira_venda_registrar($1,$2,$3,$4,$5) AS resultado',[empresaId,dados.chave,dados.data,dados.centavos,dados.observacao])
    const r=linhas[0]?.resultado
    if(r==='ok')return {ok:true}
    if(r==='sem_permissao'||r==='nao_cliente'||r==='dados_invalidos'||r==='chave_reutilizada')return {ok:false,motivo:r}
    throw new Error('Resultado de venda desconhecido')
  })
}
