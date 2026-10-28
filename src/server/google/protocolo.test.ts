import { expect, test } from 'vitest'
import { lerComando } from './protocolo'
const requisicao = (valor: unknown) => new Request('http://localhost/api/agente/google', { method: 'POST', body: JSON.stringify(valor) })
const executor = '00000000-0000-4000-8000-000000000099'

test('exige identidade durável do executor e não permite escolher outro vendedor', async () => {
  expect(await lerComando(requisicao({acao:'proximo'}))).toMatchObject({ok:false})
  expect(await lerComando(requisicao({acao:'proximo',executor}))).toEqual({ok:true,comando:{acao:'proximo',executor}})
  expect(await lerComando(requisicao({acao:'proximo',executor,vendedor:'outro'}))).toMatchObject({ok:false})
})
test('não aceita destinatário arbitrário ou comando desconhecido', async () => {
  expect(await lerComando(requisicao({ acao: 'proximo', vendedor: 'outro' }))).toMatchObject({ ok: false, status: 400 })
  expect(await lerComando(requisicao({ acao: 'apagar' }))).toMatchObject({ ok: false })
})
test('recusa corpo excessivo mesmo sem Content-Length', async () => {
  expect(await lerComando(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(9_100_000) }))).toMatchObject({ ok: false, status: 413 })
})
test('entrega exige recibo vinculado ao pedido e validação conferida', async () => {
  const pedido = '00000000-0000-4000-8000-000000000001'
  const comando = { acao: 'entregar', pedido, executor, empresas: [], recibo: { pedido_id: pedido, origem_sha256: 'a'.repeat(64), final_sha256: 'b'.repeat(64),
    arquivo_original_id: 'original', arquivo_final_id: 'final', validacao_conferida: true } }
  expect(await lerComando(requisicao(comando))).toEqual({ ok: true, comando })
  expect(await lerComando(requisicao({ ...comando, empresas: Array.from({ length: 51 }, () => ({ nome_fantasia: 'Ocorrência para auditoria' })) }))).toMatchObject({ ok: true })
  expect(await lerComando(requisicao({ ...comando, recibo: { ...comando.recibo, validacao_conferida: false } }))).toMatchObject({ ok: false })
})
test('contrato V2 permite entrega direta sem fingir WhatsApp validado', async () => {
  const pedido = '00000000-0000-4000-8000-000000000001'
  const recibo = { versao: 2, pedido_id: pedido, execucao_id: executor, lote_id: executor, revisao: 1, snapshot_sha256: 'a'.repeat(64), origem_sha256: 'b'.repeat(64), resultado_sha256: 'c'.repeat(64), arquivo_original_id: 'original', arquivo_resultado_id: 'resultado', verificacoes_requeridas: [], evidencias: [] }
  const comando = { acao: 'entregar', pedido, executor, empresas: [{ google_place_id: 'place', nome_fantasia: 'Loja sem telefone' }], recibo }
  expect(await lerComando(requisicao(comando))).toEqual({ ok: true, comando })
  expect(await lerComando(requisicao({ ...comando, recibo: { ...recibo, revisao: 0 } }))).toMatchObject({ ok: false })
})
test('reserva e conclusão V2 não aceitam destinatário escolhido pelo executor', async () => {
  const pedido = '00000000-0000-4000-8000-000000000001'
  const comando = { acao: 'reservar_lote', pedido, executor, lote: { lote_id: executor, candidatas: [{ google_place_id: 'place' }] } }
  expect(await lerComando(requisicao(comando))).toEqual({ ok: true, comando })
  expect(await lerComando(requisicao({ ...comando, vendedor_id: executor }))).toMatchObject({ ok: false })
  expect(await lerComando(requisicao({ acao: 'concluir', pedido, executor, motivo: 'sem_novidades' }))).toMatchObject({ ok: true })
})
