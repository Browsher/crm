'use server'

import { exigir } from '@/src/server/autenticacao/guarda'
import { sugerirFiltrosGoogle } from '@/src/server/google/assistente-ia'
import type { EntradaAssistente } from '@/src/lib/assistente-ia'

export async function sugerirFiltrosGoogleAcao(entrada: EntradaAssistente | string) {
  await exigir('vendedor')
  return sugerirFiltrosGoogle(entrada)
}
