import { expect, test } from 'vitest'
import { normalizarNumero } from './telefone'

test.each([
  ['(11) 2606-1244', '551126061244', 'fixo'],
  ['+55 11 2606-1244', '551126061244', 'fixo'],
  ['551126061244', '551126061244', 'fixo'],
  ['(11) 98765-4321', '5511987654321', 'celular'],
  ['+55 (11) 98765-4321', '5511987654321', 'celular'],
  ['(55) 98765-4321', '5555987654321', 'celular'],
] as const)('conserva número e tipo de %s', (bruto, numero, tipo) => {
  expect(normalizarNumero(bruto)).toEqual({ ok: true, numero, tipo })
})
test.each(['2606-1244', '98765-4321'])('não inventa DDD para %s', bruto => {
  expect(normalizarNumero(bruto)).toEqual({ ok: false, motivo: 'ddd_ausente' })
})
test('telefone vazio permanece pendente', () => {
  expect(normalizarNumero('  ')).toEqual({ ok: false, motivo: 'telefone_ausente' })
})
test.each([
  '(11) 2606-1244 ramal 2',
  '11 2606-1244 / 11 2606-1245',
  '+1 234 567 89012',
  '++551126061244',
  'ligar 1126061244',
  '1,12606E+09',
])('não transforma dados ambíguos em número: %s', bruto => {
  expect(normalizarNumero(bruto)).toEqual({ ok: false, motivo: 'telefone_invalido' })
})

test('DDI estrangeiro com onze digitos nao e reinterpretado como Brasil', () => {
  expect(normalizarNumero('+1 415 555 2671')).toEqual({ ok: false, motivo: 'telefone_invalido' })
})
