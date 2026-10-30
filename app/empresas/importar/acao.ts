'use server'

import { exigir } from '@/src/server/autenticacao/guarda'

export type EstadoImportar = {
  erro: string | null
  relatorio: null
  inseridas: null
  grupoId: null
  conferencia: null
}

// Recusa requisições de abas abertas antes da retirada do formulário.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Conserva a assinatura antiga sem processar os argumentos.
export async function importarAcao(_anterior: unknown, _form: FormData): Promise<EstadoImportar> {
  await exigir('gestor')
  return { erro: 'A importação manual de empresas foi desativada.', relatorio: null, inseridas: null, grupoId: null, conferencia: null }
}
