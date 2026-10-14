import { expect, test } from 'vitest'
import { nomeEmpresa, formatarCnpj } from './empresa-apresentacao'

test('usa o nome conhecido sem transformar fantasia em razão social', () => {
  expect(nomeEmpresa({ razaoSocial: null, nomeFantasia: 'Câmeras Aurora' })).toBe('Câmeras Aurora')
  expect(nomeEmpresa({ razaoSocial: 'Aurora LTDA', nomeFantasia: 'Aurora' })).toBe('Aurora LTDA')
  expect(nomeEmpresa({ razaoSocial: null, nomeFantasia: null })).toBe('Não informado')
  expect(formatarCnpj(null)).toBe('Não informado')
})

test('formata CNPJ numérico e alfanumérico conservando valores fora de forma', () => {
  expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81')
  expect(formatarCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  expect(formatarCnpj('123')).toBe('123')
})
