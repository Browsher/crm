import { expect, test } from 'vitest'
import { validarFiltros } from './filtros'

const entrada = { palavra: ' iluminação ', uf: 'sp', quantidade: '20' }
test('normaliza filtros e mantém a primeira página sem ampliar a consulta', () => {
  expect(validarFiltros(entrada)).toEqual({ ok: true, filtros: {
    palavra: 'iluminação', cnae: '', uf: 'SP', cidade: '', bairro: '', porte: '', tipo: '',
    contato: 'telefoneoucelular', quantidade: 20, offset: 0,
  } })
})
test.each([
  { quantidade: '101' }, { quantidade: '0' }, { quantidade: '1.5' }, { offset: '-1' },
  { uf: 'XX' }, { cnae: 'abcdefg' }, { palavra: '' }, { cidade: '', bairro: 'Centro' },
  { porte: 'gigante' }, { contato: 'qualquer' }, { palavra: 'a\u0000b' }, { tipo: 'matriz' },
])('recusa filtro que ampliaria ou adulteraria a consulta: %j', alteracao => {
  expect(validarFiltros({ ...entrada, ...alteracao }).ok).toBe(false)
})
test('CNAE com máscara permite buscar sem palavra', () => {
  const r = validarFiltros({ ...entrada, palavra: '', cnae: '47.42-3/00' })
  expect(r.ok && r.filtros.cnae).toBe('4742300')
})
