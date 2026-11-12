'use server'

import { exigir } from '@/src/server/autenticacao/guarda'
import { sugerirFiltrosBanco } from '@/src/server/busca-empresas/assistente-ia'

export async function sugerirFiltrosBancoAcao(descricao: string) {
  await exigir('vendedor')
  return sugerirFiltrosBanco(descricao)
}
