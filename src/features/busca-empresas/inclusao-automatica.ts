import type { repositorioBusca } from './repositorio'

type RepositorioInclusao = Pick<ReturnType<typeof repositorioBusca>, 'ler' | 'incluirAutomaticamente'>
export async function garantirInclusao(repo: RepositorioInclusao, id: string) {
  const busca = await repo.ler(id)
  if (!busca) return { ok: false as const, motivo: 'operacao_invalida' as const }
  if (busca.estado !== 'concluida') return { ok: true as const, aguardando: true as const, grupoId: null, inseridas: 0, vinculadas: 0 }
  return repo.incluirAutomaticamente(id)
}
