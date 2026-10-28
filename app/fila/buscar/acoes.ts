'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { criarClienteCasaDados } from '@/src/server/casa-dados/cliente'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { iniciarBusca } from '@/src/features/busca-empresas/servico'
import { garantirInclusao } from '@/src/features/busca-empresas/inclusao-automatica'
import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'
import { validarFiltros } from '@/src/features/busca-empresas/filtros'
import { prepararConsultaCasa } from '@/src/server/casa-dados/filtros'

export type EstadoBusca = { erro: string | null }
export type EstadoImportarBusca = { erro: string | null; grupoId: string | null; inseridas: number; vinculadas: number; concluido?: boolean }

export async function buscarEmpresasAcao(_anterior: EstadoBusca, form: FormData): Promise<EstadoBusca> {
  const eu = await exigir('vendedor')
  const validacao = validarFiltros(Object.fromEntries(form.entries()))
  if (!validacao.ok) return { erro: mensagemBusca('filtros_invalidos') }
  const consulta = prepararConsultaCasa(validacao.filtros)
  if (!consulta.ok) return { erro: consulta.erro }
  const repo = repositorioBusca(eu.usuarioId)
  let r
  try {
    r = await iniciarBusca({ repo, cliente: criarClienteCasaDados(process.env.CASA_DOS_DADOS_API_KEY),
      configurado: Boolean(process.env.CASA_DOS_DADOS_API_KEY?.trim()) }, String(form.get('chave') ?? ''),
      String(form.get('nome') ?? ''), Object.fromEntries(form.entries()))
  } catch {
    return { erro: 'Não foi possível salvar a busca. Confira o histórico antes de iniciar outra consulta.' }
  }
  if (!r.ok) return { erro: mensagemBusca(r.motivo) }
  let pendente = false
  try { pendente = !(await garantirInclusao(repo, r.id)).ok } catch { pendente = true }
  revalidatePath('/fila')
  revalidatePath('/fila/localizar')
  revalidatePath('/fila/buscar')
  revalidatePath('/empresas')
  revalidatePath('/empresas/busca')
  redirect('/fila/buscar?fonte=banco&busca=' + r.id + (pendente ? '&inclusao=pendente' : ''))
}
export async function concluirInclusaoAcao(_anterior: EstadoImportarBusca, form: FormData): Promise<EstadoImportarBusca> {
  const eu = await exigir('vendedor')
  const inicial = { erro: null, grupoId: null, inseridas: 0, vinculadas: 0, concluido: false }
  try {
    const r = await garantirInclusao(repositorioBusca(eu.usuarioId), String(form.get('busca') ?? ''))
    if (!r.ok) return { ...inicial, erro: mensagemBusca(r.motivo) }
    if ('aguardando' in r) return { ...inicial, erro: 'A consulta ainda não foi concluída. Os resultados permanecem salvos.' }
    revalidatePath('/fila')
    revalidatePath('/fila/localizar')
    revalidatePath('/fila/buscar')
    revalidatePath('/empresas')
    revalidatePath('/empresas/busca')
    return { erro: null, grupoId: r.grupoId, inseridas: r.inseridas, vinculadas: r.vinculadas, concluido: true }
  } catch {
    return { ...inicial, erro: 'Não foi possível concluir a inclusão. Seus resultados continuam salvos; tente novamente sem refazer a busca.' }
  }
}
