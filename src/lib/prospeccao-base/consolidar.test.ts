import { expect, test } from 'vitest'
import { consolidar } from './consolidar'
import type { Base, ColetaEntrada, FonteMaps } from './modelo'

const vazia = (): Base => ({ empresas: [], telefones: [], coletas: [] })
const fonte = (place_id: string, extra: Partial<FonteMaps> = {}): FonteMaps => ({
  place_id, nome_empresa: 'Empresa fictícia ' + place_id, cnpj: '',
  telefone: '(11) 2606-1244', endereco: 'Rua do cenário, 10, sala 2',
  link_maps: 'https://maps.google.com/', ...extra,
} as FonteMaps)
const coleta: ColetaEntrada = {
  id: 'a'.repeat(64), execucaoId: 'exec-1', fonte: 'Google Maps', regiao: 'Mooca',
  termos: ['CFTV'], data: '2026-10-14', arquivo: 'cenario.csv', sha256: 'a'.repeat(64),
}
function aplicar(base: Base, fontes: FonteMaps[], execucaoId = 'exec-1') {
  const r = consolidar(base, fontes, { ...coleta, execucaoId })
  if (!r.ok) throw new Error(r.motivo)
  return r
}
test('duas empresas compartilham telefone sem fusão', () => {
  const r = aplicar(vazia(), [fonte('p1'), fonte('p2')])
  expect(r.base.empresas.map(e => e.id)).toEqual(['google:p1', 'google:p2'])
  expect(r.base.telefones).toHaveLength(1)
  expect(r.base.telefones[0].empresas).toEqual(['google:p1', 'google:p2'])
  expect(r.base.empresas.map(e => e.revisao)).toEqual(['telefone_compartilhado', 'telefone_compartilhado'])
})
test('reprocessamento conserva empresas e telefones e registra outra execução', () => {
  const inicial = aplicar(vazia(), [fonte('p1'), fonte('p2')]).base
  const r = aplicar(inicial, [fonte('p1'), fonte('p2')], 'exec-2')
  expect(r.base.empresas).toHaveLength(2)
  expect(r.base.telefones).toHaveLength(1)
  expect(r.base.coletas).toHaveLength(6)
})
test('retry da mesma execução não duplica ocorrências', () => {
  const inicial = aplicar(vazia(), [fonte('p1')]).base
  const r = aplicar(inicial, [fonte('p1')])
  expect(r.base.coletas.map(o => o.chave)).toEqual(['exec-1:2', 'exec-1:resumo'])
})
test('conflito entre Place ID e CNPJ não funde nem cadastra terceira empresa', () => {
  const inicial = aplicar(vazia(), [
    fonte('p1', { cnpj: '11222333000181' }), fonte('p2'),
  ]).base
  const r = aplicar(inicial, [fonte('p2', { cnpj: '11222333000181' })], 'exec-2')
  expect(r.base.empresas).toEqual(inicial.empresas)
  expect(r.pendencias).toContainEqual({ linha: 2, motivo: 'identificadores_divergentes' })
  expect(r.base.coletas.find(o => o.chave === 'exec-2:2')?.fonteOriginal?.place_id).toBe('p2')
})
test('novo Place ID com CNPJ reconhecido conserva ID interno e acrescenta alias', () => {
  const inicial = aplicar(vazia(), [fonte('p1', { cnpj: '11222333000181' })]).base
  const r = aplicar(inicial, [fonte('p2', { cnpj: '11.222.333/0001-81' })], 'exec-2')
  expect(r.base.empresas).toHaveLength(1)
  expect(r.base.empresas[0]).toMatchObject({ id: 'google:p1', placeIds: ['p1', 'p2'] })
})
test('duplicata idêntica da entrada conserva duas ocorrências e um cadastro', () => {
  const r = aplicar(vazia(), [fonte('p1'), fonte('p1')])
  expect(r.base.empresas).toHaveLength(1)
  expect(r.base.coletas.filter(o => o.tipo === 'ocorrencia')).toHaveLength(2)
})
test('duplicata divergente não escolhe o primeiro endereço', () => {
  const r = aplicar(vazia(), [fonte('p1'), fonte('p1', { endereco: 'Outra rua, 20' })])
  expect(r.base.empresas).toHaveLength(0)
  expect(r.pendencias).toEqual([
    { linha: 2, motivo: 'place_id_repetido_divergente' },
    { linha: 3, motivo: 'place_id_repetido_divergente' },
  ])
})
test('empresa sem DDD permanece cadastrada sem telefone consultável', () => {
  const r = aplicar(vazia(), [fonte('p1', { telefone: '2606-1244' })])
  expect(r.base.empresas).toHaveLength(1)
  expect(r.base.empresas[0].telefoneNormalizado).toBeNull()
  expect(r.base.telefones).toEqual([])
  expect(r.pendencias).toContainEqual({ linha: 2, motivo: 'ddd_ausente' })
})
test('CNPJ inválido é preservado na fonte mas não identifica outra empresa', () => {
  const r = aplicar(vazia(), [fonte('p1', { cnpj: '11222333000182' })])
  expect(r.base.empresas[0].cnpj).toBeNull()
  expect(r.base.empresas[0].publicados.cnpj).toBe('11222333000182')
  expect(r.pendencias).toContainEqual({ linha: 2, motivo: 'cnpj_invalido' })
})
test('consulta já feita e revisão humana sobrevivem a nova fonte', () => {
  const inicial = aplicar(vazia(), [fonte('p1')]).base
  inicial.empresas[0].revisao = 'revisada'
  inicial.empresas[0].observacoes = 'Não abordar novamente'
  inicial.telefones[0].estado = 'encontrado'
  inicial.telefones[0].verificadoEm = '2026-10-14T12:00:00Z'
  const r = aplicar(inicial, [fonte('p1', { endereco: 'Rua nova, 30' })], 'exec-2')
  expect(r.base.empresas[0]).toMatchObject({ revisao: 'revisada', observacoes: 'Não abordar novamente' })
  expect(r.base.telefones[0]).toMatchObject({ estado: 'encontrado', verificadoEm: '2026-10-14T12:00:00Z' })
  expect(r.base.coletas.find(o => o.chave === 'exec-1:2')?.fonteOriginal?.endereco).toBe('Rua do cenário, 10, sala 2')
  expect(inicial.empresas[0].publicados.endereco).toBe('Rua do cenário, 10, sala 2')
})
test('mudança de telefone preserva o contato anterior no histórico da base', () => {
  const inicial = aplicar(vazia(), [fonte('p1')]).base
  const r = aplicar(inicial, [fonte('p1', { telefone: '(11) 98765-4321' })], 'exec-2')
  expect(r.base.telefones.map(t => t.numero)).toEqual(['551126061244', '5511987654321'])
  expect(r.pendencias).toContainEqual({ linha: 2, motivo: 'telefone_publicado_alterado' })
})
test('não aceita base já duplicada', () => {
  const inicial = aplicar(vazia(), [fonte('p1')]).base
  inicial.telefones.push({ ...inicial.telefones[0] })
  expect(consolidar(inicial, [fonte('p2')], coleta)).toMatchObject({ ok: false, motivo: 'base_duplicada' })
})


test.each(['identica', 'nao relacionada'])('reimportação %s preserva revisão humana do compartilhamento', caso => {
  const inicial = aplicar(vazia(), [fonte('p1'), fonte('p2')]).base
  for (const empresa of inicial.empresas) {
    empresa.revisao = 'revisada'
    empresa.observacoes = 'Compartilhamento já conferido'
  }
  const fontes = caso === 'identica' ? [fonte('p1'), fonte('p2')] : [fonte('p3', { telefone: '11987654321' })]
  const r = aplicar(inicial, fontes, 'exec-2')
  expect(r.base.empresas.slice(0, 2).map(e => [e.revisao, e.observacoes]))
    .toEqual([['revisada', 'Compartilhamento já conferido'], ['revisada', 'Compartilhamento já conferido']])
})
