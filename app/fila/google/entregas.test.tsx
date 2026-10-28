import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { ListaEntregas } from './entregas'
import type { PlanoGoogle } from '@/src/features/google/tipos'
const plano = { id: 'pedido', vendedor: 'Ana', dia: '2026-10-22', nicho: 'Loja', bairro: 'Brás', cidade: 'São Paulo', uf: 'SP',
  estado: 'concluido', entregues: 4, trabalhadas: 1, pendentes: 2, indisponiveis: 1 } as PlanoGoogle
test('a entrega possui botão de abertura, autoria e utilização real na visão do gestor', () => {
  const html = renderToStaticMarkup(<ListaEntregas planos={[plano]} gestor />)
  expect(html).toContain('Ana')
  expect(html).toContain('/empresas/google/pedido')
  expect(html).toContain('>Ver empresas e histórico</a>')
  expect(html).toContain('3 sem atendimento')
})

test('entregas usam etiqueta padronizada e diferenciam erro, cancelamento e semana vazia', () => {
  const erro = renderToStaticMarkup(<ListaEntregas planos={[{ ...plano, estado: 'falhou', motivo: 'Planilha indisponível' }]} />)
  expect(erro).toContain('data-slot="badge"')
  expect(erro).toContain('data-slot="alert"')
  expect(erro).toContain('role="alert"')
  expect(erro).toContain('Planilha indisponível')
  const cancelado = renderToStaticMarkup(<ListaEntregas planos={[{ ...plano, estado: 'cancelado', motivo: 'Não liberado pelo gestor' }]} />)
  expect(cancelado).toContain('Não liberado pelo gestor')
  expect(cancelado).not.toContain('role="alert"')
  expect(cancelado).not.toContain('Nenhuma entrega')
  const vazio = renderToStaticMarkup(<ListaEntregas planos={[]} />)
  expect(vazio).toContain('Nenhuma entrega nesta semana')
  expect(vazio).toContain('>Ver planejamento</a>')
})