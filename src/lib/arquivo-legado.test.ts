import { expect, test } from 'vitest'
import { assinaturaArquivo, validarEscopoArquivo } from './arquivo-legado'

test('assinatura do manifesto independe da ordem das chaves e muda com atividade', () => {
  expect(assinaturaArquivo({ a: 1, b: { z: 2, c: 3 } })).toBe(assinaturaArquivo({ b: { c: 3, z: 2 }, a: 1 }))
  expect(assinaturaArquivo({ a: 1 })).not.toBe(assinaturaArquivo({ a: 2 }))
})
test('operação restrita exige duas listas e 43 empresas; ensaio menor só local', () => {
  const dados = { versao: 1, gruposIds: ['a','b'], empresasIds: Array.from({ length: 43 }, (_, i) => String(i)) }
  expect(validarEscopoArquivo(dados, false)).toEqual({ ok: true })
  expect(validarEscopoArquivo({ ...dados, gruposIds: ['a'] }, false).ok).toBe(false)
  expect(validarEscopoArquivo({ ...dados, empresasIds: [] }, true).ok).toBe(false)
  expect(validarEscopoArquivo({ versao: 1, gruposIds: ['a'], empresasIds: ['b'] }, true)).toEqual({ ok: true })
})
