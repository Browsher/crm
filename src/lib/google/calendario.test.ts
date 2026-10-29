import { expect, test } from 'vitest'
import { dataPlanejadaDaRotina } from './calendario'

test.each([
  ['2026-10-23T16:59:00-03:00', null],
  ['2026-10-23T17:00:00-03:00', '2026-10-26'],
  ['2026-10-22T17:00:00-03:00', '2026-10-23'],
  ['2026-10-24T17:00:00-03:00', null],
  ['2026-10-25T17:00:00-03:00', null],
  ['2026-10-30T17:00:00-03:00', '2026-11-02'],
  ['2026-12-31T20:00:00Z', '2027-01-01'],
  ['2026-10-24T01:00:00Z', '2026-10-26'],
])('agenda de São Paulo em %s prepara %s', (agora, esperado) => {
  expect(dataPlanejadaDaRotina(new Date(agora))).toBe(esperado)
})
