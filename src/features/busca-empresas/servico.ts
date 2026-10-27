import { validarFiltros } from './filtros'
import { UUID, type RepositorioBusca, type FalhaBanco } from './repositorio'
import type { ClienteBusca, FalhaFornecedor } from './tipos'

export type MotivoBusca = FalhaFornecedor | FalhaBanco | 'nome_invalido' | 'filtros_invalidos' | 'limite' | 'pausada'
export async function iniciarBusca(
  deps: { repo: RepositorioBusca; cliente: ClienteBusca; configurado: boolean },
  chave: string, nome: string, entrada: Record<string, unknown>,
): Promise<{ ok: true; id: string } | { ok: false; motivo: MotivoBusca }> {
  if (!UUID.test(chave)) return { ok: false, motivo: 'operacao_invalida' }
  if (!nome.trim() || nome.length > 100 || /[\u0000-\u001f\u007f-\u009f]/u.test(nome)) return { ok: false, motivo: 'nome_invalido' }
  const validacao = validarFiltros(entrada)
  if (!validacao.ok) return validacao
  if (deps.cliente.validar && !deps.cliente.validar(validacao.filtros)) return { ok: false, motivo: 'filtros_invalidos' }
  if (!deps.configurado) return { ok: false, motivo: 'nao_configurado' }
  const reserva = await deps.repo.reservar(chave, nome.trim(), validacao.filtros)
  if (!reserva.ok) return reserva
  if (reserva.repetida) return { ok: true, id: chave }
  const resultado = await deps.cliente.buscar(validacao.filtros)
  await deps.repo.concluir(chave, resultado)
  return { ok: true, id: chave }
}
