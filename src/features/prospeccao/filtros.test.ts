import { describe, expect, it } from 'vitest'
import { lerFiltros } from './filtros'

const vazio = { nome: '', cnae: null, uf: null, cidade: null, bairro: null, pagina: 1 }

describe('lerFiltros', () => {
  it('aceita ausência e campos vazios do formulário', () => {
    expect(lerFiltros({})).toEqual({ ok: true, filtros: vazio })
    expect(lerFiltros({ nome: '  ', cnae: '', uf: '', cidade: '', bairro: '', pagina: '' }))
      .toEqual({ ok: true, filtros: vazio })
  })

  it('preserva os filtros combinados e literais de busca', () => {
    expect(lerFiltros({ nome: '  Café %_\\  ', cnae: '1234567', uf: 'SP', cidade: '3550308', bairro: 'Centro', pagina: '2' }))
      .toEqual({ ok: true, filtros: { nome: 'Café %_\\', cnae: '1234567', uf: 'SP', cidade: '3550308', bairro: 'Centro', pagina: 2 } })
    expect(lerFiltros({ cnae: 'nao_informado' })).toEqual({ ok: true, filtros: { ...vazio, cnae: 'nao_informado' } })
  })

  it('usa apenas o primeiro parâmetro duplicado', () => {
    expect(lerFiltros({ nome: ['Loja', 'Outra'], pagina: ['2', 'abc'], uf: [] }))
      .toEqual({ ok: true, filtros: { ...vazio, nome: 'Loja', pagina: 2 } })
    expect(lerFiltros({ cnae: ['abc', '1234567'] })).toEqual({ ok: false, motivo: 'filtro_invalido' })
  })

  it('aceita os limites de texto e página', () => {
    expect(lerFiltros({ nome: 'a'.repeat(100), uf: 'SP', cidade: '3550308', bairro: 'b'.repeat(200), pagina: '10000' }).ok).toBe(true)
  })

  it('recusa bairro só com espaços sem alterar rótulos reais', () => {
    expect(lerFiltros({ uf: 'SP', cidade: '3550308', bairro: '   ' }))
      .toEqual({ ok: false, motivo: 'filtro_invalido' })
    expect(lerFiltros({ uf: 'SP', cidade: '3550308', bairro: ' Centro ' }))
      .toEqual({ ok: true, filtros: { ...vazio, uf: 'SP', cidade: '3550308', bairro: ' Centro ' } })
  })

  it.each([
    { cnae: 'abc' }, { cnae: '123456' }, { cnae: '12345678' },
    { uf: 'sp' }, { uf: 'S' }, { uf: 'SPX' },
    { cidade: '3550308' }, { uf: 'SP', cidade: '123456' },
    { uf: 'SP', cidade: '12345678' }, { bairro: 'Centro' },
    { uf: 'SP', bairro: 'Centro' }, { nome: 'a'.repeat(101) },
    { uf: 'SP', cidade: '3550308', bairro: 'b'.repeat(201) },
    ...['0', '-1', '1.5', '1e2', '0x10', 'Infinity', 'NaN', 'abc', '10001', ' 2 '].map(pagina => ({ pagina })),
    ...['nome', 'cnae', 'uf', 'cidade', 'bairro', 'pagina'].map(campo => ({ [campo]: '\x00' })),
  ])('recusa filtro inválido sem ampliar a consulta: %j', params => {
    expect(lerFiltros(params)).toEqual({ ok: false, motivo: 'filtro_invalido' })
  })
})
