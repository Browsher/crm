import { expect, test } from 'vitest'
import { resolverIdentidade } from './identidade'
import type { CadastroIdentificado, IdentidadeImportada } from './repositorio'

const cadastro: CadastroIdentificado = { id: 'empresa-a', cnpj: '11222333000181', razaoSocial: 'Aurora LTDA' }
const linha: IdentidadeImportada = { linha: 2, cnpj: '11222333000181', razaoSocial: 'Aurora LTDA', googlePlaceId: 'ChIJ-ficticio-b' }
const preparo = (google: CadastroIdentificado | null = null) => ({
  porCnpj: new Map([[cadastro.cnpj!, cadastro]]),
  porGoogle: new Map<string, CadastroIdentificado>(google ? [[linha.googlePlaceId!, google]] : []),
})
test('dois identificadores que apontam para UUIDs diferentes exigem revisão', () => {
  expect(resolverIdentidade(linha, preparo({ id: 'empresa-b', cnpj: null, razaoSocial: null }))).toEqual({ ok: false, motivo: 'identificadores_divergentes' })
})
test('Google conhecido com CNPJ diferente exige revisão', () => {
  expect(resolverIdentidade({ ...linha, cnpj: '11444777000161' }, preparo(cadastro))).toEqual({ ok: false, motivo: 'cnpj_divergente' })
})
test('razão social conhecida divergente exige revisão', () => {
  expect(resolverIdentidade({ ...linha, razaoSocial: 'Outra LTDA' }, preparo())).toEqual({ ok: false, motivo: 'razao_social_divergente' })
})
test('identificadores iguais ou complemento vazio preservam UUID', () => {
  expect(resolverIdentidade(linha, preparo(cadastro))).toEqual({ ok: true, empresaId: 'empresa-a' })
  expect(resolverIdentidade({ ...linha, cnpj: null, razaoSocial: null }, preparo(cadastro))).toEqual({ ok: true, empresaId: 'empresa-a' })
  expect(resolverIdentidade(linha, preparo({ id: 'empresa-a', cnpj: null, razaoSocial: null }))).toEqual({ ok: true, empresaId: 'empresa-a' })
})
test('novo não procura chave nula em nenhum mapa', () => {
  expect(resolverIdentidade({ ...linha, cnpj: null }, preparo())).toEqual({ ok: true, empresaId: null })
})
