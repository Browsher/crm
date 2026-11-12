'use server'

import { exigir } from '@/src/server/autenticacao/guarda'
import { sugerirFiltrosBanco } from '@/src/server/busca-empresas/assistente-ia'
import type { EntradaAssistente } from '@/src/lib/assistente-ia'

export async function sugerirFiltrosBancoAcao(entrada: EntradaAssistente | string) {
  await exigir('vendedor')
  return sugerirFiltrosBanco(entrada)
}
