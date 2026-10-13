import { expect, test } from 'vitest'
import { validarMetadadosGrupo } from './grupo-metadados'
const base = { descricao: 'Mooca', origem: 'Google Maps', criterios: null }
test('normaliza CRLF e CR, remove só espaço ASCII/LF das extremidades e mantém LF interno', () => {
  expect(validarMetadadosGrupo({ descricao: ' Mooca\r\nCFTV \r', origem: ' Google Maps ', criterios: '\r\n ' })).toEqual({ ok: true, metadados: { descricao: 'Mooca\nCFTV', origem: 'Google Maps', criterios: null } })
  expect(validarMetadadosGrupo({ ...base, descricao: '\u00a0Mooca\u00a0' })).toEqual({ ok: true, metadados: { ...base, descricao: '\u00a0Mooca\u00a0' } })
})
test.each(['descricao', 'origem', 'criterios'] as const)('limite de %s conta pontos de código, preservando emoji', campo => {
  const limite = campo === 'criterios' ? 2000 : 500
  expect(validarMetadadosGrupo({ ...base, [campo]: '📷'.repeat(limite) }).ok).toBe(true)
  expect(validarMetadadosGrupo({ ...base, [campo]: '📷'.repeat(limite + 1) })).toEqual({ ok: false, campo, motivo: 'limite' })
})
test.each(['descricao', 'origem'] as const)('campo %s exige texto não vazio', campo => {
  for (const valor of [null, undefined, 1, {}, '', ' \r\n ']) expect(validarMetadadosGrupo({ ...base, [campo]: valor })).toEqual({ ok: false, campo, motivo: 'obrigatorio' })
})
test.each([0, 1, 9, 11, 31, 127, 128, 159])('controle Unicode %s é recusado em qualquer campo', codigo => {
  const controle = String.fromCodePoint(codigo)
  for (const campo of ['descricao', 'origem', 'criterios'] as const) expect(validarMetadadosGrupo({ ...base, [campo]: `Mooca${controle}` })).toEqual({ ok: false, campo, motivo: 'controle' })
})
