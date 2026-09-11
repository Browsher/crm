import { expect, test } from 'vitest'
import { lerEntradaReserva, mensagemReserva } from './entrada-reserva'

function dados(entradas: Record<string, string | undefined>) {
  const form = new FormData()
  for (const [k,v] of Object.entries(entradas)) if (v !== undefined) form.set(k,v)
  return form
}

test('recusa alvo/contexto inválidos e filtros inválidos sem ampliar busca', () => {
  for (const entradas of [
    { acao:'reservar', empresaId:'abc' }, { acao:'puxar',contexto:'abc' },
    { acao:'puxar',uf:'SP',cidade:'abc' }, { acao:'qualquer' },
  ]) expect(lerEntradaReserva(dados(entradas)).ok).toBe(false)
})
test('puxar usa filtros e contexto original, sem aceitar identidade do formulário', () => {
  const r = lerEntradaReserva(dados({acao:'puxar',nome:'Luz',cnae:'4742300',usuarioId:'outro'}))
  expect(r).toMatchObject({ok:true,alvo:null,contexto:null,filtros:{nome:'Luz',cnae:'4742300'}})
  expect(r).not.toHaveProperty('usuarioId')
})
test('resultado sem candidata explica preservação e não usa travessão', () => {
  expect(mensagemReserva('sem_candidata')).toContain('mantida')
  expect(mensagemReserva('contexto_alterado')).toContain('outra aba')
  expect(mensagemReserva('indisponivel')).not.toContain('—')
})
