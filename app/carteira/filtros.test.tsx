import { describe, expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import {
  filtrarCarteira,
  lerFiltrosCarteira,
  urlCarteira,
  urlFicha,
  type FiltrosCarteira,
} from './filtros'
import { FiltrosForm } from './filtros-form'

const SEM_FILTROS: FiltrosCarteira = { nome: '', uf: '', retorno: '' }

function endereco(uf: string, localidade: string) {
  return { cep: '13000000', logradouro: 'Rua A', faixa: null, bairro: 'Centro', localidade, uf, ibge: '0000000' }
}

function empresa(parcial: Partial<EmpresaComigo> & Pick<EmpresaComigo, 'id' | 'razaoSocial'>): EmpresaComigo {
  return {
    cnpj: '11222333000181',
    nomeFantasia: null,
    cnaePrincipal: null,
    ultimoContato: null,
    contatoNome: null,
    telefone: '11987654321',
    email: null,
    cep: null,
    endereco: null,
    reservadoAte: null,
    posse: true,
    proximoPasso: null,
    proximoPassoData: null,
    situacaoRetorno: 'sem_data',
    vencido: false,
    ...parcial,
  }
}

const ALFA = empresa({
  id: 'b',
  razaoSocial: 'Árvore Comércio',
  nomeFantasia: 'Alfa Luz',
  endereco: endereco('SP', 'Campinas'),
  situacaoRetorno: 'hoje',
})
const BETA = empresa({
  id: 'a',
  razaoSocial: 'Beta Iluminação',
  endereco: endereco('PR', 'Curitiba'),
  situacaoRetorno: 'atrasado',
})
const ALFA_DOIS = empresa({ id: 'a', razaoSocial: 'Árvore Comércio', situacaoRetorno: 'futuro' })

describe('filtros da carteira', () => {
  test('aceita filtros conhecidos e normaliza estado', () => {
    expect(lerFiltrosCarteira({ nome: ' Alfa ', uf: 'sp', retorno: 'hoje' })).toEqual({
      ok: true,
      filtros: { nome: 'Alfa', uf: 'SP', retorno: 'hoje' },
    })
  })

  test.each([
    { nome: ['a', 'b'] },
    { uf: ['SP', 'PR'] },
    { retorno: ['hoje', 'futuro'] },
    { nome: 'x'.repeat(121) },
    { uf: 'S' },
    { uf: '12' },
    { retorno: 'amanha' },
  ])('recusa valor invalido ou repetido: %o', params => {
    expect(lerFiltrosCarteira(params)).toEqual({ ok: false })
  })

  test('busca por razao ou fantasia e combina estado e retorno', () => {
    expect(filtrarCarteira([BETA, ALFA], { nome: 'alfa', uf: 'SP', retorno: 'hoje' })).toEqual([ALFA])
  })

  test('devolve array novo ordenado por nome e id', () => {
    const origem = [BETA, ALFA, ALFA_DOIS]
    const resultado = filtrarCarteira(origem, SEM_FILTROS)
    expect(resultado.map(item => item.id)).toEqual(['a', 'b', 'a'])
    expect(resultado).not.toBe(origem)
    expect(origem).toEqual([BETA, ALFA, ALFA_DOIS])
  })

  test('monta URLs seguras e preserva somente filtros conhecidos', () => {
    const filtros = { nome: 'A&B', uf: 'SP', retorno: 'sem_data' } satisfies FiltrosCarteira
    expect(urlCarteira(filtros)).toBe('/carteira?nome=A%26B&uf=SP&retorno=sem_data')
    expect(urlFicha('id/com?risco', filtros)).toBe('/carteira/id%2Fcom%3Frisco?nome=A%26B&uf=SP&retorno=sem_data')
    expect(urlCarteira(SEM_FILTROS)).toBe('/carteira')
  })

  test('renderiza formulario GET com opcoes derivadas da carteira autorizada', () => {
    const html = renderToStaticMarkup(<FiltrosForm filtros={SEM_FILTROS} ufs={['SP', 'PR', 'SP']} />)
    expect(html).toContain('action="/carteira"')
    expect(html).toContain('method="get"')
    expect(html).toContain('name="nome"')
    expect(html).toContain('name="uf"')
    expect(html).toContain('name="retorno"')
    expect(html.match(/value="SP"/g)).toHaveLength(1)
    expect(html).toContain('Limpar filtros')
  })
})
