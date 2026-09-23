import { expect, test } from 'vitest'
import { calcularIndicadores } from './whatsapp-indicadores'

const agora = '2026-09-22T20:00:00Z'
const m = (id: string, em: string, direcao: 'recebida' | 'enviada', fonteId = 'a', conversa = 'cliente@lid') => ({ id, em, direcao, fonteId, conversa })

test('conta conversas por fonte, pendências antigas e vendedores com envio hoje', () => {
  const mensagens = [m('1', '2026-09-22T12:00:00Z', 'recebida'), m('2', '2026-09-22T12:10:00Z', 'recebida'), m('3', '2026-09-22T12:30:00Z', 'enviada'), m('4', '2026-09-22T13:00:00Z', 'recebida', 'b'), m('5', '2026-09-20T12:00:00Z', 'recebida', 'a', 'antigo@lid')]
  expect(calcularIndicadores(mensagens, ['a', 'b'], agora)).toEqual({ conversasHoje: 2, semResposta: 2, ativosHoje: 1, vendedores: 2, mediaMinutos: 30 })
})

test('média usa primeira recebida de cada sequência e somente respostas de hoje', () => {
  expect(calcularIndicadores([
    m('0', '2026-09-21T12:00:00Z', 'recebida'), m('1', '2026-09-21T13:00:00Z', 'enviada'),
    m('2', '2026-09-22T12:00:00Z', 'recebida'), m('3', '2026-09-22T12:10:00Z', 'recebida'), m('4', '2026-09-22T12:30:00Z', 'enviada'), m('5', '2026-09-22T12:40:00Z', 'enviada'), m('6', '2026-09-22T13:00:00Z', 'recebida'), m('7', '2026-09-22T14:00:00Z', 'enviada'),
  ].reverse(), ['a'], agora).mediaMinutos).toBe(45)
})

test('desconta noites e fim de semana do tempo até resposta', () => {
  const r = calcularIndicadores([m('1', '2026-09-18T20:30:00Z', 'recebida'), m('2', '2026-09-21T12:30:00Z', 'enviada')], ['a'], '2026-09-21T18:00:00Z')
  expect(r.mediaMinutos).toBe(60)
})

test('dia é de Brasília, duplicatas não contam duas vezes e grupos/status são excluídos', () => {
  const recebida = m('1', '2026-09-22T02:30:00Z', 'recebida')
  const enviada = m('2', '2026-09-22T03:10:00Z', 'enviada')
  expect(calcularIndicadores([recebida, enviada, enviada, m('3', agora, 'recebida', 'a', 'grupo@g.us'), m('4', agora, 'recebida', 'a', 'status@broadcast'), m('5', 'inválido', 'recebida'), m('6', '2026-09-23T12:00:00Z', 'recebida')], ['a'], agora)).toEqual({ conversasHoje: 1, semResposta: 0, ativosHoje: 1, vendedores: 1, mediaMinutos: 0 })
})

test('vazio e ausência de respostas não inventam média; piloto não é vendedor', () => {
  expect(calcularIndicadores([], ['a'], agora)).toEqual({ conversasHoje: 0, semResposta: 0, ativosHoje: 0, vendedores: 1, mediaMinutos: null })
  expect(calcularIndicadores([m('1', agora, 'enviada', 'piloto')], ['piloto'], agora)).toEqual({ conversasHoje: 1, semResposta: 0, ativosHoje: 0, vendedores: 0, mediaMinutos: null })
})
