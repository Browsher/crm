import { expect, test } from 'vitest'
import { classificarConsulta, classificarConsultaComunidade, precisaConsultar } from './whatsapp'
import type { TelefoneBase } from './modelo'

const numero = '551126061244'
const quando = '2026-10-14T12:00:00Z'
const resposta = (corpo: unknown, statusHTTP: number | null = 200, conectado = true, falha: string | null = null) =>
  ({ corpo, statusHTTP, conectado, falha })
test.each([429, 500, 503, 401])('HTTP %s não vira negativo', status => {
  const [r] = classificarConsulta([numero], resposta([{ number: numero, exists: false }], status), quando)
  expect(r.estado).toBe('inconclusivo')
})
test.each([true, false])('exists booleano %s tem significado conclusivo', exists => {
  const [r] = classificarConsulta([numero], resposta([{ number: numero, exists, jid: exists ? numero + '@s.whatsapp.net' : null }]), quando)
  expect(r.estado).toBe(exists ? 'encontrado' : 'nao_encontrado')
  expect(r.numero).toBe('551126061244')
  expect(r.tipo).toBe('fixo')
})
test.each([
  [],
  [{ number: '5511987654321', exists: true }],
  [{ number: numero, exists: 'false' }],
  [{ number: numero, exists: true }, { number: numero, exists: false }],
  { exists: false },
  'not json',
])('resposta incompleta ou ambígua é inconclusiva', corpo => {
  expect(classificarConsulta([numero], resposta(corpo), quando)[0].estado).toBe('inconclusivo')
})
test('JID diferente é conservado sem alterar o número publicado', () => {
  const [r] = classificarConsulta([numero], resposta([{ number: numero, exists: true, jid: '5511926061244@s.whatsapp.net' }]), quando)
  expect(r).toMatchObject({ numero, estado: 'encontrado', jid: '5511926061244@s.whatsapp.net' })
})
test('cada número do lote recebe sua própria resposta', () => {
  const r = classificarConsulta([numero, '5511987654321'], resposta([{ number: numero, exists: true }]), quando)
  expect(r.map(t => t.estado)).toEqual(['encontrado', 'inconclusivo'])
})
test('desconexão prevalece sobre exists falso', () => {
  expect(classificarConsulta([numero], resposta([{ number: numero, exists: false }], 200, false), quando)[0].estado)
    .toBe('inconclusivo')
})
test('timeout não vaza erro de transporte e não descarta contato', () => {
  const [r] = classificarConsulta([numero], resposta(null, null, true, 'timeout apikey=segredo'), quando)
  expect(r.estado).toBe('inconclusivo')
  expect(JSON.stringify(r)).not.toContain('segredo')
  expect(r.statusHTTP).toBeNull()
  expect(r.verificadoEm).toBe(quando)
})
const telefone = (estado: TelefoneBase['estado'], revalidar = false): TelefoneBase => ({
  numero, tipo: 'fixo', empresas: ['google:p1'], estado, numeroRetornado: numero, jid: null,
  verificadoEm: quando, statusHTTP: 200, motivo: null, revalidar,
})
test.each(['encontrado', 'nao_encontrado'] as const)('não reconsulta %s sem pedido', estado => {
  expect(precisaConsultar(telefone(estado))).toBe(false)
})
test.each(['pendente', 'inconclusivo'] as const)('consulta estado %s', estado => {
  expect(precisaConsultar(telefone(estado))).toBe(true)
})
test('revalidar sim permite consultar registro conclusivo', () => {
  expect(precisaConsultar(telefone('encontrado', true))).toBe(true)
})

test.each([true, false])('nó comunitário aceita exists %s sem inventar status HTTP', exists => {
  const [r] = classificarConsultaComunidade([numero], { success:true,data:[{ number:numero,exists,jid:numero+'@s.whatsapp.net' }] }, true, quando)
  expect(r).toMatchObject({ numero,tipo:'fixo',estado:exists?'encontrado':'nao_encontrado',statusHTTP:null,motivo:null })
})

test.each([
  { success:false,error:{ message:'apikey=segredo',code:'429' } },
  { success:true,data:[{ number:numero,exists:false }],error:'contraditorio' },
  { success:'true',data:[{ number:numero,exists:false }] },
  { success:true,data:[] },
  { success:true,data:[{ number:numero,exists:'false' }] },
  { success:true,data:[{ number:'5511926061244',exists:false }] },
  null,
])('falha ou resposta incompleta da comunidade não vira negativo', retorno => {
  const [r] = classificarConsultaComunidade([numero],retorno,true,quando)
  expect(r.estado).toBe('inconclusivo')
  expect(r.statusHTTP).toBeNull()
  expect(JSON.stringify(r)).not.toContain('segredo')
})

test('conexão fechada prevalece sobre sucesso do nó comunitário', () => {
  const [r]=classificarConsultaComunidade([numero],{success:true,data:[{number:numero,exists:false}]},false,quando)
  expect(r).toMatchObject({estado:'inconclusivo',motivo:'instancia_desconectada'})
})
