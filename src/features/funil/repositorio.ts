import { comoUsuario } from '../../server/db/como-usuario'
import { UUID, type DadosVenda } from './regras'
export type Resultado = {ok:true} | {ok:false;motivo:'sem_permissao'|'encerrada'|'dados_invalidos'|'desatualizada'|'chave_reutilizada'}
async function chamar(usuarioId:string,id:string,sql:string,args:unknown[]):Promise<Resultado> {
  if (!UUID.test(id)) return {ok:false,motivo:'sem_permissao'}
  return comoUsuario(usuarioId,async e=>{
    const {linhas}=await e<{resultado:string}>(sql,[id,...args])
    const r=linhas[0]?.resultado
    if (r==='ok') return {ok:true}
    if (r==='sem_permissao'||r==='encerrada'||r==='dados_invalidos'||r==='desatualizada'||r==='chave_reutilizada') return {ok:false,motivo:r}
    throw new Error('Resultado comercial desconhecido')
  })
}
export const registrarVenda=(usuarioId:string,id:string,dados:DadosVenda)=>chamar(usuarioId,id,'SELECT funil_venda_registrar($1,$2,$3,$4,$5) AS resultado',[dados.chave,dados.data,dados.centavos,dados.observacao])
export const mudarEtapa=(usuarioId:string,id:string,etapa:string,anterior:string)=>chamar(usuarioId,id,'SELECT funil_etapa_definir($1,$2,$3) AS resultado',[etapa,anterior])
export const devolverNegociacao=(usuarioId:string,id:string,motivo:string)=>chamar(usuarioId,id,'SELECT funil_devolver($1,$2) AS resultado',[motivo])
