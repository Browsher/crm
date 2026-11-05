import { renderToStaticMarkup } from 'react-dom/server'
import { FiltrosForm } from './filtros-form'
import { expect, test, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'
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
    email: null, cep: null, endereco: null, situacao: 'atendimento', versao: 1, reservadoAte: null, posse: true,
    proximoPasso: null, proximoPassoData: null, situacaoRetorno: 'sem_data',
    vencido: false, ...p,
  }
}

test('Todos inclui atrasado, hoje e futuro, sem entradas sem data', () => {
  const linhas = [
    linha({ id: 'b', situacaoRetorno: 'hoje', proximoPassoData: '2026-09-11' }),
    linha({ id: 'c', situacaoRetorno: 'futuro', proximoPassoData: '2026-09-20' }),
    linha({ id: 'd', situacaoRetorno: 'sem_data' }),
    linha({ id: 'a', situacaoRetorno: 'atrasado', proximoPassoData: '2026-09-09' }),
  ]
  expect(agendaDoDia(linhas).map(l => l.id)).toEqual(['a', 'b', 'c'])
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
  expect(filtrarAgenda(agenda, { nome: 'acao', retorno: '', periodo: '' }, '2026-09-11').map(l => l.id)).toEqual(['a'])
  expect(filtrarAgenda(agenda, { nome: '', retorno: 'hoje', periodo: '' }, '2026-09-11').map(l => l.id)).toEqual(['b'])
})

test('filtro recusa valor fora da lista, repetido e nome longo', () => {
  expect(lerFiltrosMeuDia({ retorno: 'futuro' }).ok).toBe(false)
  expect(lerFiltrosMeuDia({ retorno: 'sem_data' }).ok).toBe(false)
  expect(lerFiltrosMeuDia({ nome: ['a', 'b'] }).ok).toBe(false)
  expect(lerFiltrosMeuDia({ nome: 'x'.repeat(121) }).ok).toBe(false)
  expect(lerFiltrosMeuDia({})).toEqual({ ok: true, filtros: { nome: '', retorno: '', periodo: '' } })
})

test('parâmetro desconhecido é ignorado, não invalida a agenda', () => {
  expect(lerFiltrosMeuDia({ de: 'meu-dia', qualquer: 'x' })).toEqual({ ok: true, filtros: { nome: '', retorno: '', periodo: '' } })
})

test('urls só carregam o que foi preenchido e marcam a origem', () => {
  expect(urlMeuDia({ nome: '', retorno: '', periodo: '' })).toBe('/meu-dia')
  expect(urlMeuDia({ nome: 'Aurora', retorno: 'atrasado', periodo: '' })).toBe('/meu-dia?nome=Aurora&retorno=atrasado')
  expect(urlFichaDoMeuDia('abc', { nome: '', retorno: '', periodo: '' })).toBe('/carteira/abc?de=meu-dia')
  expect(urlFichaDoMeuDia('abc', { nome: 'A B', retorno: 'hoje', periodo: '' }))
    .toBe('/carteira/abc?de=meu-dia&nome=A+B&retorno=hoje')
})

// `voltarDoMeuDia` é a decisão de destino de volta da ficha quando a origem é
// `?de=meu-dia`. Ela só pode devolver `urlMeuDia(filtros)` (que só monta
// `nome`/`retorno` com `URLSearchParams`, nunca ecoa a query bruta) ou o
// literal fixo `/meu-dia`. Nenhuma string vinda de `params` pode sair como
// destino: é essa a invariante de segurança que este teste protege.
test('filtros válidos do Meu dia viram a própria url da agenda', () => {
  expect(voltarDoMeuDia({})).toBe('/meu-dia')
  expect(voltarDoMeuDia({ nome: 'Aurora', retorno: 'atrasado', periodo: '' })).toBe('/meu-dia?nome=Aurora&retorno=atrasado')
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


test('cadastro parcial usa fantasia na busca e no desempate sem mudar precedência de data', () => {
  const parcial = linha({ id: 'parcial', cnpj: null, razaoSocial: null, nomeFantasia: 'Câmeras Aurora', situacaoRetorno: 'hoje', proximoPassoData: '2026-09-11' })
  expect(filtrarAgenda([parcial], { nome: 'null', retorno: '', periodo: '' }, '2026-09-11')).toEqual([])
  const anterior = linha({ id: 'anterior', razaoSocial: 'Zeta', situacaoRetorno: 'atrasado', proximoPassoData: '2026-09-10' })
  const depois = linha({ id: 'depois', razaoSocial: 'Zeta', situacaoRetorno: 'hoje', proximoPassoData: '2026-09-11' })
  expect(agendaDoDia([depois, parcial, anterior]).map(e => e.id)).toEqual(['anterior', 'parcial', 'depois'])
  expect(filtrarAgenda([parcial], { nome: 'cameras', retorno: '', periodo: '' }, '2026-09-11')).toEqual([parcial])
})


test('parsing aceita próximos e só conserva período para próximos', () => {
  expect(lerFiltrosMeuDia({ nome: ' Ação ', retorno: 'proximos', periodo: 'amanha' }))
    .toEqual({ ok: true, filtros: { nome: 'Ação', retorno: 'proximos', periodo: 'amanha' } })
  for (const retorno of ['', 'hoje', 'atrasado']) {
    expect(lerFiltrosMeuDia({ retorno, periodo: 'semana_que_vem' }))
      .toEqual({ ok: true, filtros: { nome: '', retorno, periodo: '' } })
  }
  for (const params of [
    { retorno: ['hoje', 'proximos'] }, { periodo: ['amanha', 'amanha'] },
    { retorno: 'proximos', periodo: 'hoje' }, { periodo: 'invalido' },
  ]) expect(lerFiltrosMeuDia(params).ok).toBe(false)
})

test('próximos cruza busca sem acento e limites inclusivos dos períodos', () => {
  const agenda = agendaDoDia([
    linha({ id: 'hoje', razaoSocial: 'Ação', situacaoRetorno: 'hoje', proximoPassoData: '2026-11-05' }),
    ...['2026-11-06', '2026-11-08', '2026-11-09', '2026-11-15', '2026-11-16', '2026-12-01', '2026-12-31', '2027-01-01'].map(data =>
      linha({ id: data, razaoSocial: 'Ação', situacaoRetorno: 'futuro', proximoPassoData: data })),
    linha({ id: 'outra', razaoSocial: 'Outra', situacaoRetorno: 'futuro', proximoPassoData: '2026-11-06' }),
  ])
  const filtrar = (periodo: '' | 'amanha' | 'semana_que_vem' | 'mes_que_vem') =>
    filtrarAgenda(agenda, { nome: 'ACAO', retorno: 'proximos', periodo }, '2026-11-05').map(l => l.id)
  expect(filtrar('amanha')).toEqual(['2026-11-06'])
  expect(filtrar('semana_que_vem')).toEqual(['2026-11-09', '2026-11-15'])
  expect(filtrar('mes_que_vem')).toEqual(['2026-12-01', '2026-12-31'])
  expect(filtrar('')).toEqual(['2026-11-06', '2026-11-08', '2026-11-09', '2026-11-15', '2026-11-16', '2026-12-01', '2026-12-31', '2027-01-01'])
})

test('URLs da ficha e da volta preservam período normalizado', () => {
  const filtros = { nome: 'Ação Norte', retorno: 'proximos', periodo: 'semana_que_vem' } as const
  expect(urlMeuDia(filtros)).toBe('/meu-dia?nome=A%C3%A7%C3%A3o+Norte&retorno=proximos&periodo=semana_que_vem')
  expect(urlFichaDoMeuDia('abc', filtros)).toBe('/carteira/abc?de=meu-dia&nome=A%C3%A7%C3%A3o+Norte&retorno=proximos&periodo=semana_que_vem')
  expect(voltarDoMeuDia(filtros)).toBe(urlMeuDia(filtros))
  expect(urlMeuDia({ ...filtros, retorno: 'hoje' })).toBe('/meu-dia?nome=A%C3%A7%C3%A3o+Norte&retorno=hoje')
  expect(voltarDoMeuDia({ retorno: 'proximos', periodo: ['amanha', 'amanha'] })).toBe('/meu-dia')
})


test('formulário oferece os quatro recortes e períodos preservando pesquisa', () => {
  const html = renderToStaticMarkup(<FiltrosForm filtros={{ nome: 'Ação Norte', retorno: 'proximos', periodo: 'semana_que_vem' }} />)
  const opcoes = (nome: string) => {
    const select = html.match(new RegExp(`<select[^>]*name="${nome}"[^>]*>(.*?)</select>`))?.[1] ?? ''
    return [...select.matchAll(/<option[^>]*value="([^"]*)"[^>]*>(.*?)<\/option>/g)].map(o => [o[1], o[2]])
  }
  const recortes = [...html.matchAll(/<button(?=[^>]*name="retorno")(?=[^>]*value="([^"]*)")[^>]*>(.*?)<\/button>/g)].map(b => [b[1], b[2]])
  expect(recortes).toEqual([['', 'Todos'], ['atrasado', 'Atrasos'], ['hoje', 'Hoje'], ['proximos', 'Próximos']])
  expect(opcoes('retorno')).toEqual([])
  expect(opcoes('periodo').map(o => o[0])).toEqual(['', 'amanha', 'semana_que_vem', 'mes_que_vem'])
  expect(html).toMatch(/<button(?=[^>]*value="proximos")(?=[^>]*aria-pressed="true")[^>]*>/)
  expect(html).toContain('<option value="semana_que_vem" selected="">Semana que vem</option>')
  expect(html).toContain('value="Ação Norte"')
})
