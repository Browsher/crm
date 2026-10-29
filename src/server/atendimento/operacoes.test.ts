import { expect, test } from 'vitest'
import { iniciarAtendimento, registrarContatoDireto, arquivarSemInteresse, retomarAtendimento } from './operacoes'

test('adaptadores recusam comando inválido antes da conexão sem serializar erros SQL', async () => {
  const invalido = { empresaId: 'inválido', chave: 'inválida', versao: 0 }
  expect(await iniciarAtendimento('usuario', invalido)).toEqual({ ok: false, motivo: 'dados_invalidos' })
  expect(await retomarAtendimento('usuario', invalido)).toEqual({ ok: false, motivo: 'dados_invalidos' })
  expect(await arquivarSemInteresse('usuario', invalido, null)).toEqual({ ok: false, motivo: 'dados_invalidos' })
  expect(await registrarContatoDireto('usuario', invalido, { tipo: 'nao_atendeu', nota: null, proximoPasso: null, proximoPassoData: null })).toEqual({ ok: false, motivo: 'dados_invalidos' })
})
