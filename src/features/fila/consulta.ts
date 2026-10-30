import { comoUsuario } from '../../server/db/como-usuario'
import { lerEmpresasAtendimento } from '../../server/atendimento/consulta'
import type { EmpresaComigo } from '../../lib/agenda-atendimento'
import type { Falha } from './repositorio'

export type { EmpresaComigo } from '../../lib/agenda-atendimento'
export type ResultadoMinhasEmpresas = { ok: true; reserva: EmpresaComigo | null; carteira: EmpresaComigo[]; contexto: string | null } | Falha

export async function lerMinhasEmpresas(usuarioId: string, somenteClientes = false): Promise<ResultadoMinhasEmpresas> {
  const r = await lerEmpresasAtendimento(usuarioId, somenteClientes)
  return r.ok ? { ok: true, reserva: null, carteira: r.linhas, contexto: null } : r
}

export async function clienteDaCarteira(usuarioId:string,empresaId:string):Promise<boolean> {
  return comoUsuario(usuarioId,async executar=>{
    const r=await executar<{cliente:boolean}>('SELECT EXISTS(SELECT 1 FROM minhas_empresas_clientes() WHERE empresa_id::text=$1) AS cliente',[empresaId])
    return r.linhas[0].cliente
  })
}
