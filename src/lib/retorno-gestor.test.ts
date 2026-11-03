import { expect, test } from 'vitest'
import { lerRetornoGestor, retornoColetaGestor, serializarRetornoGestor, urlRetornoGestor, type ContextoRetornoGestor } from './retorno-gestor'

const id = '11111111-1111-4111-8111-111111111111'
const vendedor = '22222222-2222-4222-8222-222222222222'
const arquivo = { tipo: 'arquivo', q: 'Luz & Cia', pagina: 2, gruposPagina: 3 } as const
const grupo = { tipo: 'grupo', id, pagina: 2, gruposPagina: 1, arquivo } as const
const google = { tipo: 'google', semana: '2026-10-28', vendedor, estado: 'concluido' } as const

test.each<[ContextoRetornoGestor, string]>([
  [arquivo, '/empresas/arquivadas?q=Luz+%26+Cia&pagina=2&gruposPagina=3'],
  [{ tipo: 'empresas', q: 'Luz', pagina: 2, uf: 'SP', cidade: '3550308', bairro: 'Sé' }, '/empresas?q=Luz&uf=SP&cidade=3550308&bairro=S%C3%A9&pagina=2'],
  [google, '/empresas/google?semana=2026-10-28&vendedor=' + vendedor + '&estado=concluido'],
])('reconstrói uma origem local com seus filtros %#', (contexto, url) => {
  const retorno = lerRetornoGestor(serializarRetornoGestor(contexto))
  expect(retorno).toEqual(contexto)
  expect(retorno && urlRetornoGestor(retorno)).toBe(url)
})

test('ficha histórica conserva origem da coleta e sua página', () => {
  const coleta = { tipo: 'coleta', id, pagina: 2, origem: google } as const
  const ficha = { tipo: 'ficha', id: vendedor, aba: 'historico', origem: coleta } as const
  const voltar = new URL(urlRetornoGestor(ficha), 'https://crm.test')
  expect(voltar.pathname).toBe('/empresas/' + vendedor)
  expect(voltar.searchParams.get('aba')).toBe('historico')
  const origem = lerRetornoGestor(voltar.searchParams.get('retorno') ?? undefined)
  expect(origem).toEqual(coleta)
  const voltarColeta = new URL(urlRetornoGestor(coleta), 'https://crm.test')
  expect(voltarColeta.pathname).toBe('/empresas/google/' + id)
  expect(voltarColeta.searchParams.get('pagina')).toBe('2')
  expect(lerRetornoGestor(voltarColeta.searchParams.get('retorno') ?? undefined)).toEqual(google)
})

test('a coleta do Histórico mantém a ficha anterior e sua coleta paginada', () => {
  const anterior = { tipo: 'coleta', id, pagina: 2, origem: google } as const
  const historico = { tipo: 'ficha', id: vendedor, aba: 'historico', origem: anterior } as const
  const atual = retornoColetaGestor(id, 3, historico)
  expect(lerRetornoGestor(serializarRetornoGestor(atual))).toEqual({
    tipo: 'coleta', id, pagina: 3, origem: historico,
  })
  const depois = retornoColetaGestor(id, 4, { ...historico, origem: atual })
  expect(lerRetornoGestor(serializarRetornoGestor(depois))).toEqual({
    tipo: 'coleta', id, pagina: 4,
    origem: { ...historico, origem: { tipo: 'coleta', id, pagina: 3 } },
  })
})

test('grupo preserva separadamente a página interna e o recorte do arquivo', () => {
  const url = new URL(urlRetornoGestor(grupo), 'https://crm.test')
  expect(url.pathname).toBe('/empresas/grupos/' + id)
  expect(url.searchParams.get('pagina')).toBe('2')
  expect(lerRetornoGestor(url.searchParams.get('retorno') ?? undefined)).toEqual(arquivo)
})

test.each([
  undefined, ['uma', 'duas'], 'https://externo.test', '//externo.test',
  '{"tipo":"arquivo","tipo":"arquivo","q":"","pagina":1,"gruposPagina":1}',
  '{"tipo":"arquivo","q":"A\\u0000B","pagina":1,"gruposPagina":1}',
  '{"tipo":"arquivo","q":"A\\u0085B","pagina":1,"gruposPagina":1}',
  JSON.stringify({ ...arquivo, q: 'x'.repeat(101) }),
  JSON.stringify({ ...arquivo, q: 'x'.repeat(4096) }),
  JSON.stringify({ ...arquivo, pagina: 0 }),
  JSON.stringify({ ...arquivo, gruposPagina: 1_000_001 }),
  JSON.stringify({ ...arquivo, pagina: '2' }),
  JSON.stringify({ ...grupo, id: '../grupos' }),
  JSON.stringify({ ...grupo, arquivo: grupo }),
  JSON.stringify({ ...google, estado: 'rascunho' }),
  JSON.stringify({ ...google, vendedor: '//externo.test' }),
  JSON.stringify({ ...google, semana: '2026-02-30' }),
  JSON.stringify({ tipo: 'coleta', id, pagina: 101, origem: google }),
  JSON.stringify({ tipo: 'ficha', id, aba: 'dados', origem: arquivo }),
  JSON.stringify({ tipo: 'ficha', id, aba: 'historico', origem: { tipo: 'ficha', id, aba: 'historico', origem: arquivo } }),
  JSON.stringify({ ...arquivo, url: 'https://externo.test' }),
])('recusa transporte ambíguo, fora dos limites ou de outra origem %#', entrada => {
  expect(lerRetornoGestor(entrada)).toBeNull()
})

const conversa = {
  tipo: 'whatsapp', vendedor, busca: 'Luz & Cia', categoria: 'pendentes', painel: 'conversa',
  conversa: { fonteId: vendedor, id: '98765:10@lid' },
} as const

test('WhatsApp recompõe somente destino local e sobrevive à composição do Histórico', () => {
  const ficha = { tipo: 'ficha', id, aba: 'historico', origem: conversa } as const
  const coleta = retornoColetaGestor(id, 2, ficha)
  expect(lerRetornoGestor(serializarRetornoGestor(coleta))).toEqual(coleta)
  const url = new URL(urlRetornoGestor(conversa), 'https://crm.test')
  expect(url.pathname).toBe('/whatsapp')
  expect(lerRetornoGestor(url.searchParams.get('retorno') ?? undefined)).toEqual(conversa)
})

test('configuração pode voltar ao filtro sem uma seleção de conversa', () => {
  const recorte = { tipo: 'whatsapp', vendedor: 'piloto', busca: '', categoria: 'ausentes', painel: 'lista' } as const
  expect(lerRetornoGestor(serializarRetornoGestor(recorte))).toEqual(recorte)
})

test('recusa fonte diferente do vendedor no filtro específico', () => {
  expect(lerRetornoGestor(JSON.stringify({ ...conversa, vendedor: 'piloto' }))).toBeNull()
})

test.each([
  { vendedor: '//externo.test' },
  { categoria: 'vendida' }, { painel: 'invisivel' }, { conversa: undefined },
  { busca: 'x'.repeat(101) }, { conversa: { fonteId: vendedor } },
  { conversa: { fonteId: vendedor, id: '' } }, { conversa: { fonteId: vendedor, id: 'a\u0000@lid' } },
  { conversa: { fonteId: vendedor, id: 'a'.repeat(257) } },
  { conversa: { fonteId: vendedor, id: 'x@lid', mensagem: 'conteúdo privado' } },
])('recusa contexto de conversa que excede o contrato %#', campos => {
  expect(lerRetornoGestor(JSON.stringify({ ...conversa, ...campos }))).toBeNull()
})
