import { expect, test, vi } from 'vitest'
const direto = vi.hoisted(() => vi.fn())
vi.mock('../../server/atendimento/operacoes', () => ({ registrarContatoDireto: direto }))
import { registrarContato } from './repositorio'
test('repositório usa apenas comando direto com chave/versão e preserva resposta', async () => {
  const comando = { empresaId: 'empresa', chave: 'chave', versao: 2 }
  const entrada = { tipo: 'nao_atendeu' as const, nota: null, proximoPasso: null, proximoPassoData: null }
  direto.mockResolvedValue({ ok: false, motivo: 'desatualizada' })
  expect(await registrarContato('eu', comando, entrada)).toEqual({ ok:false, motivo:'desatualizada' })
  expect(direto).toHaveBeenCalledWith('eu', comando, entrada)
})