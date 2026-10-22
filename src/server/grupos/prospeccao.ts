import { comoUsuario } from '../db/como-usuario'

export type GrupoProspeccao = { id:string; nome:string; descricao:string|null; origem:string|null; criterios:string|null; criadoEm:string; total:number; disponiveis:number; googleLegado?:boolean }
export type ResultadoGrupoProspeccao = {ok:true;grupo:GrupoProspeccao}|{ok:false;motivo:'sem_permissao'|'grupo_indisponivel'}
type Linha = Omit<GrupoProspeccao,'criadoEm'|'total'|'disponiveis'> & {criado_em:Date|string;total:string;disponiveis:string;google_legado?:boolean}
function traduzirGrupo(g:Linha):GrupoProspeccao {
  return {id:g.id,nome:g.nome,descricao:g.descricao,origem:g.origem,criterios:g.criterios,criadoEm:new Date(g.criado_em).toISOString(),total:Number(g.total),disponiveis:Number(g.disponiveis),...(g.google_legado?{googleLegado:true}:{})}
}

export type ResultadoGruposProspeccao = {ok:true;grupos:GrupoProspeccao[];temProxima:boolean}|{ok:false;motivo:'sem_permissao'}
export async function listarGruposProspeccao(usuarioId:string,pagina=1):Promise<ResultadoGruposProspeccao> {
  if(!Number.isInteger(pagina)||pagina<1||pagina>10000) throw new RangeError('Página de listas inválida')
  try {
    return await comoUsuario(usuarioId,async executar=> {
      const {linhas}=await executar<Linha>(`WITH google AS MATERIALIZED (SELECT id FROM public.busca_empresa_grupos_google())
        SELECT g.*,EXISTS(SELECT 1 FROM google WHERE google.id=g.id) AS google_legado FROM public.grupos_prospeccao_listar($1) g`,[pagina])
      return {ok:true as const,grupos:linhas.slice(0,20).map(traduzirGrupo),temProxima:linhas.length>20}
    })
  } catch(erro) {
    if((erro as {code?:string})?.code==='42501') return {ok:false,motivo:'sem_permissao'}
    throw erro
  }
}

export async function lerGrupoProspeccao(usuarioId:string,grupoId:string):Promise<ResultadoGrupoProspeccao> {
  try {
    return await comoUsuario(usuarioId,async executar=> {
      const {linhas} = await executar<Linha>('SELECT * FROM public.grupo_prospeccao_ler($1)',[grupoId])
      const g=linhas[0]
      if(!g) return {ok:false as const,motivo:'grupo_indisponivel' as const}
      return {ok:true as const,grupo:traduzirGrupo(g)}
    })
  } catch(erro) {
    if((erro as {code?:string})?.code==='42501') return {ok:false,motivo:'sem_permissao'}
    throw erro
  }
}
