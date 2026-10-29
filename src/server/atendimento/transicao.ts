import { comoUsuario } from '../db/como-usuario'

export type EvidenciasVinculo = {
  responsavel: string | null
  google: string | null
  candidatos: string[]
  ativos: string[]
}

export type DecisaoVinculo = { tipo: 'vincular'; vendedorId: string } | { tipo: 'pendente'; motivo: string }

export function classificarVinculoLegado(e: EvidenciasVinculo): DecisaoVinculo {
  if (e.responsavel && e.google && e.responsavel !== e.google) return { tipo: 'pendente', motivo: 'conflito_google' }
  if (e.responsavel) return e.ativos.includes(e.responsavel)
    ? { tipo: 'vincular', vendedorId: e.responsavel }
    : { tipo: 'pendente', motivo: 'responsavel_inativo' }
  if (e.google) return e.ativos.includes(e.google)
    ? { tipo: 'vincular', vendedorId: e.google }
    : { tipo: 'pendente', motivo: 'google_inativo' }
  const candidatos = [...new Set(e.candidatos)]
  if (!candidatos.length) return { tipo: 'pendente', motivo: 'sem_evidencia' }
  if (candidatos.some(id => !e.ativos.includes(id))) return { tipo: 'pendente', motivo: 'candidato_inativo' }
  if (candidatos.length !== 1) return { tipo: 'pendente', motivo: 'multiplos_candidatos' }
  return { tipo: 'vincular', vendedorId: candidatos[0] }
}

export type RelatorioTransicao = {
  totais: { empresas: number; vinculosInequivocos: number; pendencias: number }
  pendencias: { empresaId: string; motivo: string; candidatos: string[] }[]
  proximo: string | null
}

type ResultadoInventario = { ok: true; dados: RelatorioTransicao } | { ok: false; motivo: 'sem_permissao' | 'filtros_invalidos' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function inventariarTransicao(gestorId: string, depois: string | null, limite: number): Promise<ResultadoInventario> {
  if (!UUID.test(gestorId) || (depois !== null && !UUID.test(depois)) || !Number.isInteger(limite) || limite < 1 || limite > 100) {
    return { ok: false, motivo: 'filtros_invalidos' }
  }
  return comoUsuario(gestorId, async executar => {
    await executar('SET TRANSACTION READ ONLY')
    const { linhas } = await executar<{ resultado: ResultadoInventario }>(
      'SELECT atendimento_transicao_inventariar($1,$2) AS resultado', [depois, limite],
    )
    return linhas[0].resultado
  })
}
