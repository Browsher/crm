import { expect, test } from 'vitest'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import {
  agendaDoDia,
  filtrarAgenda,
  lerFiltrosMeuDia,
  urlFichaDoMeuDia,
  urlMeuDia,
  voltarDoMeuDia,
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

// `voltarDoMeuDia` é a decisão de destino de volta da ficha quando a origem é
// `?de=meu-dia`. Ela só pode devolver `urlMeuDia(filtros)` (que só monta
// `nome`/`retorno` com `URLSearchParams`, nunca ecoa a query bruta) ou o
// literal fixo `/meu-dia`. Nenhuma string vinda de `params` pode sair como
// destino: é essa a invariante de segurança que este teste protege.
test('filtros válidos do Meu dia viram a própria url da agenda', () => {
  expect(voltarDoMeuDia({})).toBe('/meu-dia')
  expect(voltarDoMeuDia({ nome: 'Aurora', retorno: 'atrasado' })).toBe('/meu-dia?nome=Aurora&retorno=atrasado')
})

test('filtro inválido cai no literal fixo /meu-dia', () => {
  expect(voltarDoMeuDia({ retorno: 'futuro' })).toBe('/meu-dia')
  expect(voltarDoMeuDia({ nome: 'x'.repeat(121) })).toBe('/meu-dia')
})

test('retorno repetido em array (query maliciosa ou mal formada) cai no literal fixo', () => {
  expect(voltarDoMeuDia({ retorno: ['atrasado', 'hoje'] })).toBe('/meu-dia')
  expect(voltarDoMeuDia({ nome: ['a', 'b'] })).toBe('/meu-dia')
})

test('nenhuma tentativa de destino arbitrário na query vira o caminho de volta', () => {
  // `nome` é dado de busca, não destino: mesmo carregando algo parecido com
  // URL, sai como valor de `nome` dentro de `urlMeuDia`, nunca como um novo
  // caminho, protocolo ou host.
  const comUrlAbsoluta = voltarDoMeuDia({ nome: 'https://exemplo.invalido' })
  expect(comUrlAbsoluta).toBe('/meu-dia?nome=https%3A%2F%2Fexemplo.invalido')
  expect(comUrlAbsoluta.startsWith('/meu-dia')).toBe(true)

  const comProtocoloRelativo = voltarDoMeuDia({ nome: '//evil.example.com' })
  expect(comProtocoloRelativo).toBe('/meu-dia?nome=%2F%2Fevil.example.com')
  expect(comProtocoloRelativo.startsWith('/meu-dia')).toBe(true)

  // Um parâmetro `de`/`href`/`voltarPara` (nome que não existe em
  // `FiltrosMeuDia`) não é lido por `lerFiltrosMeuDia`, então não influencia
  // o destino de jeito nenhum.
  expect(voltarDoMeuDia({ de: 'meu-dia', href: 'https://exemplo.invalido/roubado' })).toBe('/meu-dia')
})
