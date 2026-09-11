import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { rascunhoInicial } from '@/src/features/contato/rascunho'
import { EntradaSemReserva } from './entrada-sem-reserva'

const estado = vi.hoisted(() => ({ entradas: {} as Record<string, unknown> }))
vi.mock('./rascunhos', () => ({ useRascunhos: () => estado }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('./formulario', () => ({ Formulario: () => <div>Recuperar anotações</div> }))
const filtros = { nome: '', cnae: null, uf: null, cidade: null, bairro: null, pagina: 1 }

test('mantém editor quando a reserva expirou mesmo com nota vazia', () => {
  estado.entradas = { a: { nome: 'Empresa', valor: rascunhoInicial(false), expirada: true } }
  expect(renderToStaticMarkup(<EntradaSemReserva filtros={filtros} contexto={null} />)).toContain('Recuperar anotações')
})
test('mantém anotações sem reserva atual', () => {
  estado.entradas = { a: { nome: 'Empresa', valor: { ...rascunhoInicial(false), nota: 'Ligar amanhã' } } }
  expect(renderToStaticMarkup(<EntradaSemReserva filtros={filtros} contexto={null} />)).toContain('Recuperar anotações')
})
test('entrada vazia oferece localizar empresa', () => {
  estado.entradas = {}
  expect(renderToStaticMarkup(<EntradaSemReserva filtros={filtros} contexto={null} />)).toContain('Localizar empresa')
})
