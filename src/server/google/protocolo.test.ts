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
