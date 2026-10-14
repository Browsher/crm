import { expect, test } from 'vitest'
import { prepararSemente } from './semente'
import { serializarAbas, desserializarAbas } from '../../lib/prospeccao-base/abas'
import type { ColetaEntrada, FonteMaps } from '../../lib/prospeccao-base/modelo'

const fonte = (): FonteMaps => ({
  place_id: 'p1', nome_empresa: '=Empresa literal', cnpj: '',
  telefone: '(11) 2606-1244', endereco: 'Rua do cenário, 12, "sala 4"',
  link_maps: 'https://maps.google.com/', cep: '03123000', observacoes: 'Publicação original',
})
const coleta: ColetaEntrada = {
  id: 'a'.repeat(64), execucaoId: 'exec-1', fonte: 'Google Maps', regiao: 'Mooca',
  termos: ['CFTV'], data: '2026-10-14', arquivo: 'cenario.csv', sha256: 'a'.repeat(64),
}
const resultado = (telefone = '551126061244') => ({
  telefone, estado: 'encontrado', jid: telefone + '@s.whatsapp.net',
  verificadoEm: '2026-10-14T12:00:00Z', statusHTTP: 200,
})
function seed(resultados: unknown = { resultados: [resultado()] }) {
  const r = prepararSemente([fonte()], resultados, coleta)
  if (!r.ok) throw new Error(r.motivo)
  return r.base
}
test('consulta de outro telefone não marca a empresa como encontrada', () => {
  const base = seed({ resultados: [resultado('5511987654321')] })
  expect(base.telefones[0].estado).toBe('pendente')
})
test('aplica a consulta medida preservando associações', () => {
  const base = seed()
  expect(base.telefones[0]).toMatchObject({
    numero: '551126061244', estado: 'encontrado', empresas: ['google:p1'],
    verificadoEm: '2026-10-14T12:00:00Z', statusHTTP: 200,
  })
})
test('resultados duplicados recusam a carga antes de escrita', () => {
  expect(prepararSemente([fonte()], { resultados: [resultado(), { ...resultado(), estado: 'nao_encontrado' }] }, coleta))
    .toMatchObject({ ok: false, motivo: 'resultados_invalidos' })
})
test.each([
  { ...resultado(), estado: 'sim' },
  { ...resultado(), telefone: 551126061244 },
  { ...resultado(), verificadoEm: 'ontem' },
  { ...resultado(), statusHTTP: 500 },
])('resposta de seed sem contrato válido é recusada', resposta => {
  expect(prepararSemente([fonte()], { resultados: [resposta] }, coleta)).toMatchObject({ ok: false })
})
test('roundtrip da base conserva fontes completas, endereço e strings literais', () => {
  const base = seed()
  const abas = serializarAbas(base)
  expect(abas.Empresas[0]).toMatchObject({
    nome: '=Empresa literal', cep: '03123000', endereco_publicado: 'Rua do cenário, 12, "sala 4"',
  })
  expect(desserializarAbas(abas)).toEqual({ ok: true, base })
})
test('estado editado para valor desconhecido não é tratado como negativo', () => {
  const abas = serializarAbas(seed())
  abas.Telefones[0].whatsapp = 'talvez'
  expect(desserializarAbas(abas)).toMatchObject({ ok: false, motivo: 'base_invalida' })
})
test('telefone editado para número em notação científica é recusado', () => {
  const abas: Record<string, Record<string, unknown>[]> = serializarAbas(seed())
  abas.Telefones[0].numero = 5.51126061244e11
  expect(desserializarAbas(abas)).toMatchObject({ ok: false })
})
test('JSON de associação incompatível bloqueia a base', () => {
  const abas = serializarAbas(seed())
  abas.Telefones[0].empresas_ids = '["empresa-inexistente"]'
  expect(desserializarAbas(abas)).toMatchObject({ ok: false })
})
test('célula acima do limite não é truncada', () => {
  const base = seed()
  base.empresas[0].observacoes = 'a'.repeat(49001)
  expect(() => serializarAbas(base)).toThrow('Célula excede 49000')
})


test('quantidade de empresas numérica vinda da tabela nativa não altera identidade textual', () => {
  const abas: Record<string, Record<string, unknown>[]> = serializarAbas(seed())
  abas.Telefones[0].quantidade_empresas = 1
  expect(desserializarAbas(abas)).toMatchObject({ ok: true })
})
