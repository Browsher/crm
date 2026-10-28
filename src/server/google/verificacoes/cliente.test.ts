import { expect, test } from 'vitest'
import { criteriosVazios } from '@/src/lib/google/criterios'
import { executarVerificacoes, conferirRetornoVerificacoes } from './cliente'
const contexto = { pedido_id: '00000000-0000-4000-8000-000000000001', execucao_id: '00000000-0000-4000-8000-000000000002', lote_id: '00000000-0000-4000-8000-000000000003', revisao: 1, snapshot_sha256: 'a'.repeat(64), criterios: criteriosVazios() }
const env = { GOOGLE_VERIFICACOES_URL: 'https://n8n.exemplo.test/webhook/crm-google', GOOGLE_VERIFICACOES_TOKEN: 'segredo-apenas-teste' }
const candidata = { google_place_id: 'place-a', telefone: '1133334444', nome_fantasia: 'Loja' }
test('sem filtros não exige configuração nem faz requisição externa', async () => {
  const r = await executarVerificacoes(contexto, [candidata], async () => { throw new Error('Não deveria chamar') }, {})
  expect(r).toEqual({ verificacoes_requeridas: [], evidencias: [] })
})
test('reconciliação confere resposta salva sem executar outro pedido de verificação', () => {
  expect(conferirRetornoVerificacoes(contexto, [candidata], { ...contexto, evidencias: [] })).toEqual({verificacoes_requeridas:[],evidencias:[]})
  expect(() => conferirRetornoVerificacoes(contexto, [candidata], { ...contexto, revisao: 2, evidencias: [] })).toThrow('não confirmada')
})
test('nota e avaliações enviam uma chamada ao workflow único com critérios congelados', async () => {
  let chamadas = 0
  const c = { ...contexto, criterios: { ...criteriosVazios(), nota: 4, avaliacoes: 10 } }
  const r = await executarVerificacoes(c, [candidata], async (_url, init) => {
    chamadas++
    const body = JSON.parse(String(init?.body))
    expect(body).toMatchObject({ ...c, verificacoes_requeridas: ['dados_google'], candidatas: [candidata] })
    expect(body).not.toHaveProperty('token')
    return Response.json({ ...contexto, evidencias: ['nota', 'avaliacoes'].map(criterio => ({ candidata: 'place-a', criterio, opcao: criterio === 'nota' ? '4' : '10', estado: 'aprovado', motivo: 'Dado publicado', fonte: 'google_maps', horario: '2026-10-23T17:00:00-03:00' })) })
  }, env)
  expect(chamadas).toBe(1)
  expect(r.evidencias).toHaveLength(2)
})
test('resposta de outro lote ou candidata não aprova os resultados', async () => {
  const c = { ...contexto, criterios: { ...criteriosVazios(), email: ['com' as const] } }
  await expect(executarVerificacoes(c, [candidata], async () => Response.json({ ...contexto, lote_id: contexto.pedido_id, evidencias: [] }), env)).rejects.toThrow('não confirmada')
  await expect(executarVerificacoes(c, [candidata], async () => Response.json({ ...contexto, evidencias: [{ candidata: 'outra', criterio: 'email', opcao: 'com', estado: 'aprovado', motivo: 'Dado publicado', fonte: 'google_maps', horario: '2026-10-23T17:00:00Z' }] }), env)).rejects.toThrow('não confirmada')
})
test('falha de serviço fica pendente e nunca se transforma em sem e-mail', async () => {
  const c = { ...contexto, criterios: { ...criteriosVazios(), email: ['sem' as const] } }
  await expect(executarVerificacoes(c, [candidata], async () => { throw new Error('timeout com segredo') }, env)).rejects.toThrow('não confirmada')
  await expect(executarVerificacoes(c, [candidata], undefined, {})).rejects.toThrow('configurada')
})
test('contato aprovado deve corresponder ao telefone publicado daquela empresa', async () => {
  const c = { ...contexto, criterios: { ...criteriosVazios(), telefone: ['fixo' as const] } }
  await expect(executarVerificacoes(c, [candidata], async () => Response.json({ ...contexto, evidencias: [{ candidata: 'place-a', criterio: 'telefone', opcao: 'fixo', contato: '1122223333', estado: 'aprovado', motivo: 'Formato', fonte: 'coleta', horario: '2026-10-23T17:00:00Z' }] }), env)).rejects.toThrow('não confirmada')
})
