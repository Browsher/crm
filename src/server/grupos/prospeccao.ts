import { comoUsuario } from '../db/como-usuario'

export type GrupoProspeccao = { id:string; nome:string; descricao:string|null; origem:string|null; criterios:string|null; criadoEm:string; total:number; disponiveis:number }
export type ResultadoGrupoProspeccao = {ok:true;grupo:GrupoProspeccao}|{ok:false;motivo:'sem_permissao'|'grupo_indisponivel'}
type Linha = Omit<GrupoProspeccao,'criadoEm'|'total'|'disponiveis'> & {criado_em:Date|string;total:string;disponiveis:string}
export async function lerGrupoProspeccao(usuarioId:string,grupoId:string):Promise<ResultadoGrupoProspeccao> {
  try {
    return await comoUsuario(usuarioId,async executar=> {
      const {linhas} = await executar<Linha>('SELECT * FROM public.grupo_prospeccao_ler($1)',[grupoId])
      const g=linhas[0]
      if(!g) return {ok:false as const,motivo:'grupo_indisponivel' as const}
      return {ok:true as const,grupo:{id:g.id,nome:g.nome,descricao:g.descricao,origem:g.origem,criterios:g.criterios,criadoEm:new Date(g.criado_em).toISOString(),total:Number(g.total),disponiveis:Number(g.disponiveis)}}
    })
  } catch(erro) {
    if((erro as {code?:string})?.code==='42501') return {ok:false,motivo:'sem_permissao'}
    throw erro
  }
}
