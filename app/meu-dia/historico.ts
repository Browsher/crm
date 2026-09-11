import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { lerHistorico, type Contato } from '@/src/features/contato/historico'

export type ResultadoAgendaHistorico =
  | { ok: true; contatos: Contato[] }
  | { ok: false; motivo: 'fora_da_carteira' | 'falha' }

export async function historicoDaAgenda(usuarioId: string, empresaId: string): Promise<ResultadoAgendaHistorico> {
  const minhas = await lerMinhasEmpresas(usuarioId)
  if (!minhas.ok) return { ok: false, motivo: 'falha' }
  // Empresa fora da carteira responde igual a empresa inexistente: a existência
  // dela não é informação que o vendedor deva receber. Mesma decisão do
  // notFound() de app/carteira/[id]/page.tsx.
  if (!minhas.carteira.some((e) => e.id === empresaId)) return { ok: false, motivo: 'fora_da_carteira' }
  const r = await lerHistorico(usuarioId, empresaId)
  return r.ok ? { ok: true, contatos: r.contatos } : { ok: false, motivo: 'falha' }
}
