import { expect, test } from 'vitest'
import { bancoInicial, lerBanco, sugerirNomeBanco } from './banco-empresas'
const novo = (patch = {}) => ({ ...bancoInicial(), cnaesSecundarios: [], ...patch })

test('payload histórico continua sem propriedades novas após leitura', () => {
  const anterior = bancoInicial(), r = lerBanco(JSON.stringify(anterior))
  expect(r.ok).toBe(true)
  if(r.ok)expect(JSON.stringify(r.filtros)).toBe(JSON.stringify(anterior))
})
test('aceita novos critérios opcionais sem reescrever seu significado', () => {
  const f=novo({ cnaes:['4755502'],cnaesSecundarios:['4742300'],aberturaUltimosDias:'30',excluirMei:true,meiExclusaoDe:'2025-01-01',excluirSimples:true,simplesExclusaoAte:'2026-10-01' })
  expect(lerBanco(f)).toEqual({ok:true,filtros:f})
})
test.each(['0','-1','1.5','2147483648','abc'])('recusa últimos dias inválido %s', aberturaUltimosDias=>{
  expect(lerBanco(novo({aberturaUltimosDias}))).toEqual({ok:false})
})
test.each([
 {aberturaUltimosDias:'7',aberturaDe:'2026-01-01'}, {excluirMei:true,portes:['MEI']},
 {excluirSimples:true,regimes:['Simples Nacional']}, {meiExclusaoDe:'2026-01-01'},
 {excluirMei:true,meiExclusaoDe:'2026-02-30'}, {excluirMei:true,meiExclusaoDe:'2026-10-02',meiExclusaoAte:'2026-10-01'},
 {excluirSimples:true,simplesExclusaoDe:'2026-10-02',simplesExclusaoAte:'2026-10-01'},
 {excluirMei:'true'}, {cnaesSecundarios:['123']}, {cnaesSecundarios:['4755502','4755502']},
 {cnaesSecundarios:['4742300'],atividadeTipo:['principal','secundaria']},
])('recusa combinação contraditória ou malformada %j', patch=>{
 expect(lerBanco(novo(patch))).toEqual({ok:false})
})
test('datas de exclusão parciais e dias1 são válidos',()=>{
 expect(lerBanco(novo({excluirMei:true,meiExclusaoAte:'2026-10-01',excluirSimples:true,simplesExclusaoDe:'2025-01-01',aberturaUltimosDias:'1'})).ok).toBe(true)
})
test('nome sugerido também funciona com apenas CNAE secundário',()=>{
 const f=novo({cnaesSecundarios:['4742300']})
 expect(sugerirNomeBanco(f)).toBe('4742300 · Brasil')
})
