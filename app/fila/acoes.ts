'use server'
import { exigir } from '@/src/server/autenticacao/guarda'
export type EstadoFila = { erro: string | null; filaVazia: boolean; resultado?: string; empresaId?: string | null }
// Formulários antigos não adquirem empresas. O vendedor escolhe uma empresa pessoal.
export async function agirNaFilaAcao(_anterior: EstadoFila, _form: FormData): Promise<EstadoFila> {
  void _anterior; void _form
  await exigir('vendedor')
  return { erro: 'Este fluxo foi encerrado. Localize uma das suas empresas para iniciar o atendimento.', filaVazia: false }
}
