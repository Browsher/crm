'use server'

import { exigir } from '@/src/server/autenticacao/guarda'
import { sugerirFiltrosGoogle } from '@/src/server/google/assistente-ia'

export async function sugerirFiltrosGoogleAcao(descricao: string) {
  await exigir('vendedor')
  return sugerirFiltrosGoogle(descricao)
}
