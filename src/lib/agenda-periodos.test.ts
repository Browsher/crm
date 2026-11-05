import { expect, test } from 'vitest'
import { dataCivilSaoPaulo, limitesPeriodoAgenda } from './agenda-periodos'

test('data civil usa Brasília antes e depois de sua meia-noite', () => {
  expect(dataCivilSaoPaulo(new Date('2026-11-06T02:59:59.999Z'))).toBe('2026-11-05')
  expect(dataCivilSaoPaulo(new Date('2026-11-06T03:00:00.000Z'))).toBe('2026-11-06')
})

test('amanhã, semana seguinte e mês seguinte usam dias civis inclusivos', () => {
  expect(limitesPeriodoAgenda('2026-11-05', 'amanha')).toEqual({ inicio: '2026-11-06', fim: '2026-11-06' })
  expect(limitesPeriodoAgenda('2026-11-05', 'semana_que_vem')).toEqual({ inicio: '2026-11-09', fim: '2026-11-15' })
  expect(limitesPeriodoAgenda('2026-11-08', 'semana_que_vem')).toEqual({ inicio: '2026-11-09', fim: '2026-11-15' })
  expect(limitesPeriodoAgenda('2026-11-09', 'semana_que_vem')).toEqual({ inicio: '2026-11-16', fim: '2026-11-22' })
  expect(limitesPeriodoAgenda('2026-11-05', 'mes_que_vem')).toEqual({ inicio: '2026-12-01', fim: '2026-12-31' })
  expect(limitesPeriodoAgenda('2026-11-05', '')).toEqual({ inicio: '2026-11-06', fim: null })
})

test('virada de ano e fevereiro bissexto independem do fuso do host', () => {
  expect(limitesPeriodoAgenda('2026-12-31', 'amanha')).toEqual({ inicio: '2027-01-01', fim: '2027-01-01' })
  expect(limitesPeriodoAgenda('2026-12-31', 'semana_que_vem')).toEqual({ inicio: '2027-01-04', fim: '2027-01-10' })
  expect(limitesPeriodoAgenda('2026-12-31', 'mes_que_vem')).toEqual({ inicio: '2027-01-01', fim: '2027-01-31' })
  expect(limitesPeriodoAgenda('2028-01-31', 'mes_que_vem')).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' })
  expect(limitesPeriodoAgenda('2028-02-28', 'amanha')).toEqual({ inicio: '2028-02-29', fim: '2028-02-29' })
  expect(limitesPeriodoAgenda('2028-02-29', 'amanha')).toEqual({ inicio: '2028-03-01', fim: '2028-03-01' })
})
