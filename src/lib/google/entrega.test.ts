import { expect, test } from 'vitest'
import { criteriosVazios } from './criterios'
import { avaliarEntrega, regrasExigidas, type EvidenciaGoogle } from './entrega'

const evidencia = (criterio: EvidenciaGoogle['criterio'], opcao: string, estado: EvidenciaGoogle['estado'] = 'aprovado'): EvidenciaGoogle => ({ candidata: 'place-a', criterio, opcao, estado, motivo: 'Conferido na fonte', fonte: 'https://exemplo.test', horario: '2026-10-23T17:05:00-03:00', contato: '1133334444' })
test('entrega neutra não exige validação e termos não viram filtros', () => {
  expect(avaliarEntrega({ ...criteriosVazios(), termos: 'lojas' }, [])).toEqual({ estado: 'aprovado' })
})
test('site e e-mail precisam passar junto com pelo menos um contato', () => {
  const c = { ...criteriosVazios(), site: ['com' as const], email: ['com' as const], telefone: ['whatsapp' as const, 'fixo' as const] }
  const ev = [evidencia('site', 'com'), evidencia('email', 'com'), evidencia('telefone', 'whatsapp', 'reprovado'), evidencia('telefone', 'fixo')]
  expect(avaliarEntrega(c, ev)).toEqual({ estado: 'aprovado' })
  expect(avaliarEntrega(c, ev.filter(e => e.criterio !== 'email'))).toMatchObject({ estado: 'nao_confirmado' })
  expect(avaliarEntrega(c, ev.map(e => e.criterio === 'site' ? { ...e, estado: 'reprovado' as const } : e))).toMatchObject({ estado: 'reprovado' })
})
test('ausência ou falha não prova sem e-mail', () => {
  expect(avaliarEntrega({ ...criteriosVazios(), email: ['sem'] }, [])).toMatchObject({ estado: 'nao_confirmado' })
})
test('evidência de outra opção não aprova o critério escolhido', () => {
  expect(avaliarEntrega({ ...criteriosVazios(), nota: 4 }, [evidencia('nota', '3')])).toMatchObject({ estado: 'nao_confirmado' })
})
test('alternativas de perfil são OU e preferências não bloqueiam', () => {
  const c = { ...criteriosVazios(), tipos: ['varejista' as const, 'atacadista' as const], atendimento: 'priorizar_fisica' as const, prioridades: 'Mais próximos' }
  expect(avaliarEntrega(c, [evidencia('tipos', 'varejista')])).toEqual({ estado: 'aprovado' })
  expect(regrasExigidas(c)).toEqual([{ criterio: 'tipos', opcoes: ['varejista', 'atacadista'] }])
})
