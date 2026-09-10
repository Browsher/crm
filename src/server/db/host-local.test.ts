import { describe, expect, test } from 'vitest'
import { exigirHostLocal, HostNaoLocal } from './host-local'

describe('exigirHostLocal', () => {
  test.each([
    ['localhost', 'postgres://postgres:postgres@localhost:5432/postgres'],
    ['127.0.0.1', 'postgres://postgres:postgres@127.0.0.1:5432/postgres'],
    ['::1', 'postgres://postgres:postgres@[::1]:5432/postgres'],
  ])('aceita %s', (_, url) => {
    expect(() => exigirHostLocal(url)).not.toThrow()
  })

  test('recusa host remoto', () => {
    const url = 'postgres://u:s@shuttle.proxy.rlwy.net:41234/railway'
    expect(() => exigirHostLocal(url)).toThrow(HostNaoLocal)
  })

  test('a mensagem diz o motivo e nomeia o host recusado', () => {
    const url = 'postgres://u:s@shuttle.proxy.rlwy.net:41234/railway'
    expect(() => exigirHostLocal(url)).toThrow(/a suíte só roda contra banco local/)
    expect(() => exigirHostLocal(url)).toThrow(/apaga bancos e altera papéis/)
    expect(() => exigirHostLocal(url)).toThrow(/shuttle\.proxy\.rlwy\.net/)
  })

  test('a mensagem não vaza a senha da URL', () => {
    const url = 'postgres://u:senhasecreta@shuttle.proxy.rlwy.net:41234/railway'
    try {
      exigirHostLocal(url)
      throw new Error('devia ter lançado')
    } catch (erro) {
      expect((erro as Error).message).not.toContain('senhasecreta')
    }
  })

  test('recusa host desconhecido qualquer', () => {
    expect(() => exigirHostLocal('postgres://u:s@10.0.0.7:5432/x')).toThrow(HostNaoLocal)
  })

  test('URL que não parseia é recusada, não aceita por engano', () => {
    expect(() => exigirHostLocal('nao é uma url')).toThrow(HostNaoLocal)
  })
})
