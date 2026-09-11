import { expect, test, vi } from 'vitest'
const revalidar = vi.hoisted(() => vi.fn())
const redirecionar = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath: revalidar }))
vi.mock('next/navigation', () => ({ redirect: redirecionar }))
vi.mock('../../server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'eu' }) }))
vi.mock('./repositorio', () => ({ registrarContato: async () => ({ ok: true }) }))
import { registrarContatoAcao } from './acao'

function devolucao(voltarPara?: string): FormData {
  const form = new FormData()
  form.set('id', 'empresa')
  form.set('tipo', 'nao_atendeu')
  form.set('desfecho', 'devolver')
  if (voltarPara !== undefined) form.set('voltarPara', voltarPara)
  return form
}

test('contato bem sucedido atualiza lista de empresas recentes', async () => {
  const form = new FormData()
  form.set('id', 'empresa')
  form.set('tipo', 'nao_atendeu')
  form.set('desfecho', 'nenhum')
  const r = await registrarContatoAcao({ erro: null, ok: false }, form)
  expect(r.ok).toBe(true)
  expect(revalidar).toHaveBeenCalledWith('/fila/localizar')
})

test('devolver pela ficha volta para o destino previsto, com os filtros', async () => {
  redirecionar.mockClear()
  await registrarContatoAcao({ erro: null, ok: false }, devolucao('/meu-dia?nome=Aurora&retorno=atrasado'))
  expect(redirecionar).toHaveBeenCalledWith('/meu-dia?nome=Aurora&retorno=atrasado')
})

// O campo é input oculto: quem manda é o cliente. Sem conferência no servidor,
// a própria aplicação levaria o vendedor para fora do site.
test('devolver com destino externo nao sai do site', async () => {
  redirecionar.mockClear()
  await registrarContatoAcao({ erro: null, ok: false }, devolucao('https://exemplo.invalido/roubo'))
  expect(redirecionar).toHaveBeenCalledWith('/carteira')
})

test('devolver pela fila, que nao manda destino, nao redireciona', async () => {
  redirecionar.mockClear()
  await registrarContatoAcao({ erro: null, ok: false }, devolucao())
  expect(redirecionar).not.toHaveBeenCalled()
})
