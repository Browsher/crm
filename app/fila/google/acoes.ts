'use server'

import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { validarPlano } from '@/src/features/google/regras'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { sincronizarPedido } from '@/src/server/google/planilha/sincronizar'

export type EstadoPlano = { erro: string | null; salvo: boolean; sincronizacao?: 'sincronizado' | 'pendente'; aviso?: string }
async function concluirSalvamento(r: { ok: true; ids: string[] } | { ok: false; motivo: string }): Promise<EstadoPlano> {
  if (!r.ok) return { erro: r.motivo, salvo: false }
  let sincronizacao: 'sincronizado' | 'pendente' = 'sincronizado'
  for (const id of r.ids) if ((await sincronizarPedido(id)).estado === 'pendente') sincronizacao = 'pendente'
  for (const caminho of ['/fila/google', '/fila/buscar', '/empresas/google']) revalidatePath(caminho)
  return { erro: null, salvo: true, sincronizacao, aviso: sincronizacao === 'pendente' ? 'Salvo no CRM. A sincronização com a planilha está pendente.' : 'Salvo no CRM e sincronizado com a planilha.' }
}
export async function salvarSemanaAcao(_anterior: EstadoPlano, form: FormData): Promise<EstadoPlano> {
  const eu = await exigir('vendedor')
  try {
    const texto = form.get('dias')
    if (typeof texto !== 'string' || texto.length > 160000) return { erro: 'Confira o planejamento informado.', salvo: false }
    const dados: unknown = JSON.parse(texto)
    if (!Array.isArray(dados) || dados.length < 1 || dados.length > 5) return { erro: 'Escolha os dias desta semana.', salvo: false }
    const dias = []
    for (const d of dados) {
      if (!d || typeof d !== 'object' || Array.isArray(d)) return { erro: 'Confira os campos de cada dia.', salvo: false }
      const r = validarPlano(d)
      if (!r.ok) return { erro: r.motivo, salvo: false }
      dias.push(r.plano)
    }
    return await concluirSalvamento(await repositorioGoogle(eu.usuarioId).salvarSemana(dias))
  } catch { return { erro: 'Não foi possível salvar. Confira os dias antes de tentar novamente.', salvo: false } }
}
export async function copiarPlanoAcao(_anterior: EstadoPlano, form: FormData): Promise<EstadoPlano> {
  const eu = await exigir('vendedor')
  const origem = String(form.get('origem') ?? '')
  const revisao = Number(form.get('revisao'))
  const destinos = form.getAll('destinos').map(String)
  const campos = form.getAll('campos').map(String)
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(origem) || !Number.isSafeInteger(revisao) || revisao < 1
    || !destinos.length || destinos.length > 10 || !campos.length || campos.length > 3 || campos.some(c => !['nicho', 'criterios', 'regiao'].includes(c))) return { erro: 'Escolha origem, campos e dias de destino.', salvo: false }
  try {
    return await concluirSalvamento(await repositorioGoogle(eu.usuarioId).copiarDia(origem, revisao, destinos, campos as ('nicho' | 'criterios' | 'regiao')[]))
  } catch { return { erro: 'Não foi possível espelhar. Atualize o planejamento e confira os dias.', salvo: false } }
}
export async function salvarPlanoAcao(_anterior: EstadoPlano, form: FormData): Promise<EstadoPlano> {
  const eu = await exigir('vendedor')
  const entrada = validarPlano(Object.fromEntries(form.entries()))
  if (!entrada.ok) return { erro: entrada.motivo, salvo: false }
  try {
    const r = await repositorioGoogle(eu.usuarioId).planejar(entrada.plano)
    if (!r.ok) return { erro: r.motivo, salvo: false }
    const sync = await sincronizarPedido(r.id)
    revalidatePath('/fila/google')
    revalidatePath('/fila/buscar')
    revalidatePath('/empresas/google')
    return { erro: null, salvo: true, sincronizacao: sync.estado, aviso: sync.estado==='pendente'?sync.motivo:undefined }
  } catch { return { erro: 'Não foi possível salvar. Confira o planejamento antes de tentar novamente.', salvo: false } }
}
export async function sincronizarPlanoAcao(_anterior: {erro:string|null},form: FormData): Promise<{erro:string|null;sucesso?:boolean}> {
  const eu = await exigir('usuario')
  const id = String(form.get('pedido')??'')
  if (!await repositorioGoogle(eu.usuarioId).podeSincronizar(id)) return {erro:'Este pedido não está disponível para seu acesso.'}
  const r = await sincronizarPedido(id)
  revalidatePath('/fila/google')
  revalidatePath('/fila/buscar')
  revalidatePath('/empresas/google')
  return r.estado==='sincronizado'?{erro:null,sucesso:true}:{erro:r.motivo}
}
export async function prospectarGoogleAcao(_anterior: { erro: string | null }, _form: FormData): Promise<{ erro: string | null }> {
  void _anterior; void _form
  await exigir('vendedor')
  return { erro: 'Este fluxo foi encerrado. Use Iniciar atendimento na empresa escolhida.' }
}
