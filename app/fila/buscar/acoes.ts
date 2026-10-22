'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { criarClienteCnpjBiz } from '@/src/server/cnpj-biz/cliente'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { iniciarBusca } from '@/src/features/busca-empresas/servico'
import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'

export type EstadoBusca = { erro: string | null }
export type EstadoImportarBusca = { erro: string | null; grupoId: string | null; inseridas: number; vinculadas: number }

export async function buscarEmpresasAcao(_anterior: EstadoBusca, form: FormData): Promise<EstadoBusca> {
  const eu = await exigir('vendedor')
  let r
  try {
    r = await iniciarBusca({ repo: repositorioBusca(eu.usuarioId), cliente: criarClienteCnpjBiz(process.env.CNPJ_BIZ_API_KEY),
      configurado: Boolean(process.env.CNPJ_BIZ_API_KEY?.trim()) }, String(form.get('chave') ?? ''),
      String(form.get('nome') ?? ''), Object.fromEntries(form.entries()))
  } catch {
    return { erro: 'Não foi possível salvar a busca. Confira o histórico antes de iniciar outra consulta.' }
  }
  if (!r.ok) return { erro: mensagemBusca(r.motivo) }
  revalidatePath('/fila/buscar')
  redirect('/fila/buscar?fonte=banco&busca=' + r.id)
}
export async function importarBuscaAcao(_anterior: EstadoImportarBusca, form: FormData): Promise<EstadoImportarBusca> {
  const eu = await exigir('vendedor')
  const inicial = { erro: null, grupoId: null, inseridas: 0, vinculadas: 0 }
  try {
    const cnpjs = form.getAll('cnpjs')
    if (cnpjs.some(c => typeof c !== 'string')) return { ...inicial, erro: mensagemBusca('operacao_invalida') }
    const r = await repositorioBusca(eu.usuarioId).importar(String(form.get('busca') ?? ''), cnpjs as string[])
    if (!r.ok) return { ...inicial, erro: mensagemBusca(r.motivo) }
    revalidatePath('/fila')
    revalidatePath('/fila/buscar')
    revalidatePath('/empresas')
    revalidatePath('/empresas/busca')
    return { erro: null, grupoId: r.grupoId, inseridas: r.inseridas, vinculadas: r.vinculadas }
  } catch {
    return { ...inicial, erro: 'Não foi possível importar. A seleção permanece disponível para conferência.' }
  }
}
