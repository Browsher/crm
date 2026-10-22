import { expect, test, vi } from 'vitest'
import { iniciarBusca } from './servico'
import type { RepositorioBusca } from './repositorio'

const entrada = { palavra: 'iluminação', uf: 'SP', quantidade: '2' }
const chave = '11111111-1111-4111-8111-111111111111'
function dependencias(reserva: unknown = { ok: true, repetida: false }) {
  const ordem: string[] = []
  const repo = {
    reservar: vi.fn(async () => { ordem.push('reservar'); return reserva }),
    concluir: vi.fn(async () => { ordem.push('concluir') }),
  } as unknown as RepositorioBusca
  const cliente = { buscar: vi.fn(async () => { ordem.push('http'); return { ok: true as const, empresas: [] } }) }
  return { repo, cliente, configurado: true, ordem }
}
test('reserva cota antes do HTTP e persiste antes de devolver o identificador', async () => {
  const deps = dependencias()
  expect(await iniciarBusca(deps, chave, 'Lojas SP', entrada)).toEqual({ ok: true, id: chave })
  expect(deps.ordem).toEqual(['reservar', 'http', 'concluir'])
})
test('mesma chave retorna histórico sem emitir uma segunda requisição', async () => {
  const deps = dependencias({ ok: true, repetida: true })
  expect(await iniciarBusca(deps, chave, 'Lojas SP', entrada)).toEqual({ ok: true, id: chave })
  expect(deps.ordem).toEqual(['reservar'])
})
test.each(['limite', 'pausada', 'sem_permissao'])('bloqueio %s não chega ao fornecedor', async motivo => {
  const deps = dependencias({ ok: false, motivo })
  expect(await iniciarBusca(deps, chave, 'Lojas SP', entrada)).toEqual({ ok: false, motivo })
  expect(deps.cliente.buscar).not.toHaveBeenCalled()
})
test('sem configuração ou filtros inválidos não consome quota', async () => {
  const deps = dependencias()
  expect(await iniciarBusca({ ...deps, configurado: false }, chave, 'Lojas SP', entrada)).toEqual({ ok: false, motivo: 'nao_configurado' })
  expect(await iniciarBusca(deps, chave, 'Lojas SP', { ...entrada, quantidade: '101' })).toEqual({ ok: false, motivo: 'filtros_invalidos' })
  expect(await iniciarBusca(deps, 'invalida', 'Lojas SP', entrada)).toEqual({ ok: false, motivo: 'operacao_invalida' })
  expect(deps.repo.reservar).not.toHaveBeenCalled()
})
test('falha do fornecedor fica persistida e abre histórico com motivo estável', async () => {
  const deps = dependencias()
  const cliente = { buscar: vi.fn(async () => ({ ok: false as const, motivo: 'tempo_esgotado' as const })) }
  expect(await iniciarBusca({ ...deps, cliente }, chave, 'Lojas SP', entrada)).toEqual({ ok: true, id: chave })
  expect(deps.repo.concluir).toHaveBeenCalledWith(chave, { ok: false, motivo: 'tempo_esgotado' })
})
