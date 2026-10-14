import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
import { compilarCodigoN8n } from './codigo-n8n'

test('compila imports próprios sem depender de require externo', () => {
  const codigo = compilarCodigoN8n({
    'lib/telefone': "export function numero(v: string) { return '55' + v }",
    'lib/entrada': "import { numero } from './telefone'; export function consultar(v: string) { return numero(v) }",
  }, 'lib/entrada')
  const lib = runInNewContext(codigo, {})
  expect(lib.consultar('1126061244')).toBe('551126061244')
})
test('proíbe dependência fora do mapa fechado', () => {
  expect(() => compilarCodigoN8n({ entrada: "import fs from 'node:fs'; export const dado = fs" }, 'entrada'))
    .toThrow('Módulo externo')
})
test('recusa fonte TypeScript sintaticamente inválida', () => {
  expect(() => compilarCodigoN8n({ entrada: 'export const = ;' }, 'entrada')).toThrow()
})
