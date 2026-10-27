import { expect, test } from 'vitest'
import { iniciarCnpjBizDeTeste } from '../../../tests/e2e/cnpj-biz-mock'

test('mock Casa reconhece busca textual em array e simula falta de créditos', async () => {
  const mock = await iniciarCnpjBizDeTeste()
  try {
    const r = await fetch(mock.url + '/v5/cnpj/pesquisa?tipo_resultado=completo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': 'chave-apenas-e2e' }, body: JSON.stringify({ limite: 1, busca_textual: [{ texto: ['falha simulada'], tipo_busca: 'radical' }] }) })
    expect(r.status).toBe(403)
    expect(await (await fetch(mock.url + '/estatisticas')).json()).toEqual({ consultas: 1 })
  } finally { await mock.fechar() }
})
