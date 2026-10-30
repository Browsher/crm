import { expect, test } from 'vitest'
import { prepararEnvio, rascunhoInicial } from './rascunho'
test('repetição mantém chave, versão e entrada mesmo depois de nova versão do servidor', () => {
  const valor = { ...rascunhoInicial(false), nota: 'Primeira nota' }
  const primeiro = prepararEnvio(null, 3, valor)
  expect(prepararEnvio(primeiro, 9, valor)).toBe(primeiro)
  expect(() => prepararEnvio(primeiro, 9, { ...valor, nota: 'Outra nota' })).toThrow('envio anterior')
})
