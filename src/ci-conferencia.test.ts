import { expect, test } from 'vitest'
import { decidirConferencia } from '../scripts/ci/politica-conferencia'

test.each([
  [false, false, 'Browsher', 'falhar'],
  [false, false, 'dependabot[bot]', 'pular'],
  [false, false, 'dependabot', 'falhar'],
  [false, true, 'alguem', 'pular'],
  [true, false, 'Browsher', 'conferir'],
  [true, true, 'alguem', 'conferir'],
  [true, false, 'dependabot[bot]', 'conferir'],
])('URL=%s fork=%s autor=%s: %s', (temUrl, fork, autor, esperado) => {
  expect(decidirConferencia({ temUrl, fork, autor })).toBe(esperado)
})
