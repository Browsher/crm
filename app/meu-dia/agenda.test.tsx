import { expect, test } from 'vitest'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import {
  agendaDoDia,
  filtrarAgenda,
  lerFiltrosMeuDia,
  urlFichaDoMeuDia,
  urlMeuDia,
} from './agenda'

function linha(p: Partial<EmpresaComigo> & { id: string }): EmpresaComigo {
  return {
    cnpj: '0', razaoSocial: 'Empresa', nomeFantasia: null,
    cnaePrincipal: null, ultimoContato: null, contatoNome: null, telefone: '1',
    email: null, cep: null, endereco: null, reservadoAte: null, posse: true,
    proximoPasso: null, proximoPassoData: null, situacaoRetorno: 'sem_data',
    vencido: false, ...p,
  }
}

test('agenda traz só atrasado e hoje, atrasados primeiro', () => {
  const linhas = [
    linha({ id: 'b', situacaoRetorno: 'hoje', proximoPassoData: '2026-09-11' }),
    linha({ id: 'c', situacaoRetorno: 'futuro', proximoPassoData: '2026-09-20' }),
    linha({ id: 'd', situacaoRetorno: 'sem_data' }),
    linha({ id: 'a', situacaoRetorno: 'atrasado', proximoPassoData: '2026-09-09' }),
  ]
  expect(agendaDoDia(linhas).map(l => l.id)).toEqual(['a', 'b'])
})

test('dentro do mesmo estado ordena por data, nome e id', () => {
  const linhas = [
    linha({ id: '2', razaoSocial: 'Beta', situacaoRetorno: 'atrasado', proximoPassoData: '2026-09-08' }),
    linha({ id: '1', razaoSocial: 'Beta', situacaoRetorno: 'atrasado', proximoPassoData: '2026-09-08' }),
    linha({ id: '3', razaoSocial: 'Alfa', situacaoRetorno: 'atrasado', proximoPassoData: '2026-09-07' }),
  ]
  expect(agendaDoDia(linhas).map(l => l.id)).toEqual(['3', '1', '2'])
})

test('busca por nome ignora acento e caixa, e o filtro de retorno recorta', () => {
  const linhas = [
    linha({ id: 'a', razaoSocial: 'Ação Norte', situacaoRetorno: 'atrasado', proximoPassoData: '2026-09-09' }),
    linha({ id: 'b', razaoSocial: 'Outra', situacaoRetorno: 'hoje', proximoPassoData: '2026-09-11' }),
  ]
  const agenda = agendaDoDia(linhas)
  expect(filtrarAgenda(agenda, { nome: 'acao', retorno: '' }).map(l => l.id)).toEqual(['a'])
  expect(filtrarAgenda(agenda, { nome: '', retorno: 'hoje' }).map(l => l.id)).toEqual(['b'])
})

test('filtro recusa valor fora da lista, repetido e nome longo', () => {
  expect(lerFiltrosMeuDia({ retorno: 'futuro' }).ok).toBe(false)
  expect(lerFiltrosMeuDia({ retorno: 'sem_data' }).ok).toBe(false)
  expect(lerFiltrosMeuDia({ nome: ['a', 'b'] }).ok).toBe(false)
  expect(lerFiltrosMeuDia({ nome: 'x'.repeat(121) }).ok).toBe(false)
  expect(lerFiltrosMeuDia({})).toEqual({ ok: true, filtros: { nome: '', retorno: '' } })
})

test('parâmetro desconhecido é ignorado, não invalida a agenda', () => {
  expect(lerFiltrosMeuDia({ de: 'meu-dia', qualquer: 'x' })).toEqual({ ok: true, filtros: { nome: '', retorno: '' } })
})

test('urls só carregam o que foi preenchido e marcam a origem', () => {
  expect(urlMeuDia({ nome: '', retorno: '' })).toBe('/meu-dia')
  expect(urlMeuDia({ nome: 'Aurora', retorno: 'atrasado' })).toBe('/meu-dia?nome=Aurora&retorno=atrasado')
  expect(urlFichaDoMeuDia('abc', { nome: '', retorno: '' })).toBe('/carteira/abc?de=meu-dia')
  expect(urlFichaDoMeuDia('abc', { nome: 'A B', retorno: 'hoje' }))
    .toBe('/carteira/abc?de=meu-dia&nome=A+B&retorno=hoje')
})
