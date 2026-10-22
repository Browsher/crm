import { expect, test } from 'vitest'
import { clienteAgente } from './cliente'

test('retorno incerto não repete uma chamada nem segue redirecionamento', async () => {
  let chamadas = 0
  const cliente = clienteAgente({ url: 'http://localhost:3100', token: 'fixture', fetcher: async (_url, opcoes) => {
    chamadas++
    expect(opcoes?.redirect).toBe('error')
    throw new Error('rede')
  } })
  await expect(cliente({ acao: 'proximo' })).rejects.toThrow('não confirmado')
  expect(chamadas).toBe(1)
})
test('não envia segredo por HTTP remoto', () => {
  expect(() => clienteAgente({ url: 'http://servidor.example', token: 'fixture' })).toThrow('HTTPS')
})
