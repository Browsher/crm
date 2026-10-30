import { comoUsuario } from './db/como-usuario'
import type { ConsultaPessoal, FiltrosPessoais } from '../lib/prospeccao-pessoal'
import type { ResumoEmpresa } from '../lib/empresa-visual'
// O banco retorna o resumo comum junto aos campos legados até a migração das rotas.
export type ConsultaAtendimentoPessoal = Omit<ConsultaPessoal,'empresas'> & {empresas:(ConsultaPessoal['empresas'][number] & ResumoEmpresa)[]}
export async function lerEmpresasPessoais(usuarioId:string,filtros:FiltrosPessoais):Promise<{ok:true;dados:ConsultaAtendimentoPessoal}|{ok:false;motivo:'filtros_invalidos'|'sem_permissao'}> {
  try {
    return await comoUsuario(usuarioId,async sql=>{
      const r=await sql<{dados:ConsultaAtendimentoPessoal}>('SELECT prospeccao_pessoal($1) AS dados',[JSON.stringify(filtros)])
      return {ok:true as const,dados:r.linhas[0].dados}
    })
  } catch(erro) {
    const codigo=(erro as {code?:string}).code
    if(codigo==='22023') return {ok:false,motivo:'filtros_invalidos'}
    if(codigo==='42501') return {ok:false,motivo:'sem_permissao'}
    throw erro
  }
}
