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
