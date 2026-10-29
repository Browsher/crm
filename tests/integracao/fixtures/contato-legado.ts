import { comoUsuario } from '@/src/server/db/como-usuario'
import type { TipoContato } from '@/src/lib/atendimento'
// Apenas preserva fixtures de reserva durante a transição. Remover na Task9.
export async function registrarContatoLegado(usuarioId: string, empresaId: string, v: { tipo: TipoContato; nota: string | null; proximoPasso: string | null; proximoPassoData: string | null; desfecho: 'nenhum' | 'assumir' | 'devolver' }) {
  try {
    return await comoUsuario(usuarioId, async sql => {
      const { linhas } = await sql<{ resultado: string }>('SELECT contato_registrar($1,$2,$3,$4,$5,$6) AS resultado', [empresaId, v.tipo, v.nota, v.proximoPasso, v.proximoPassoData, v.desfecho])
      const motivo = linhas[0].resultado
      if (motivo === 'ok') return { ok: true as const }
      if (['nao_encontrada', 'reserva_expirada', 'ja_e_sua'].includes(motivo)) return { ok: false as const, motivo }
      throw new Error('Resultado legado desconhecido')
    })
  } catch (erro) {
    if ((erro as { code?: string }).code === '42501') return { ok: false as const, motivo: 'sem_permissao' }
    throw erro
  }
}