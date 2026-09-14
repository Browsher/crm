import { expect, test } from 'vitest'
import { lerFiltrosEmpresas } from './filtros'
import { destinoCanonico } from './consulta'

test('sem selects, filtros de Empresas ficam ausentes', () => {
  expect(lerFiltrosEmpresas({})).toEqual({ ok: true, filtros: { cnae: null, uf: null, cidade: null, bairro: null } })
})

test('aceita CNAE não informado e localização com código IBGE', () => {
  expect(lerFiltrosEmpresas({ cnae: 'nao_informado', uf: 'SP', cidade: '3550308', bairro: 'Mooca' })).toEqual({
    ok: true, filtros: { cnae: 'nao_informado', uf: 'SP', cidade: '3550308', bairro: 'Mooca' },
  })
})

test.each([
  { cnae: '4742-3/00' },
  { cnae: '474230' },
  { uf: 'sp' },
  { uf: 'SP1' },
  { cidade: '3550308' },
  { uf: 'SP', cidade: 'São Paulo' },
  { uf: 'SP', bairro: 'Mooca' },
  { uf: 'SP', cidade: '3550308', bairro: ' ' },
  { uf: 'SP', cidade: '3550308', bairro: 'a'.repeat(201) },
  { uf: 'SP', cidade: '3550308', bairro: 'Moo\x00ca' },
])('recusa select inválido sem convertê-lo em consulta irrestrita: %j', params => {
  expect(lerFiltrosEmpresas(params)).toEqual({ ok: false, motivo: 'filtro_invalido' })
})

test('q vazio é removido sem perder os quatro selects e a página', () => {
  const destino = destinoCanonico({ q: '', cnae: '4742300', uf: 'SP', cidade: '3550308', bairro: 'Mooca & Brás', pagina: '2' })
  expect(destino).not.toBeNull()
  const params = new URL(destino!, 'http://localhost').searchParams
  expect(Object.fromEntries(params)).toEqual({ cnae: '4742300', uf: 'SP', cidade: '3550308', bairro: 'Mooca & Brás', pagina: '2' })
  expect(destinoCanonico(Object.fromEntries(params))).toBeNull()
})

test('canonicalização não apaga filtro inválido antes de exibir erro', () => {
  expect(destinoCanonico({ q: '', cidade: '3550308' })).toBeNull()
})
