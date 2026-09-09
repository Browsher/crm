import { describe, expect, test } from 'vitest'
import { lerManifesto, somaDoArquivo } from './manifesto'

describe('lerManifesto', () => {
  test('lê o manifesto real da base', () => {
    const m = lerManifesto('db/cep/opencep.json')
    expect(m).toEqual({
      fonte: 'opencep',
      versao: '2.0.1',
      publicado_em: '2024-07-08',
      url: 'https://github.com/SeuAliado/OpenCEP/releases/download/2.0.1/v1.zip',
      sha256: 'cffa33783b7cb2bec060acd499eb8356698918efdc79238708aac46fcce9e62d',
      linhas_esperadas: 1209313,
    })
  })

  test('manifesto inexistente lança, não devolve objeto meio vazio', () => {
    expect(() => lerManifesto('db/cep/nao-existe.json')).toThrow()
  })
})

describe('somaDoArquivo', () => {
  test('devolve sha256 em minúsculas, 64 caracteres', async () => {
    const s = await somaDoArquivo('tests/fixtures/cep-mini.zip')
    expect(s).toMatch(/^[0-9a-f]{64}$/)
  })

  test('a mesma soma nas duas chamadas', async () => {
    const [a, b] = await Promise.all([
      somaDoArquivo('tests/fixtures/cep-mini.zip'),
      somaDoArquivo('tests/fixtures/cep-mini.zip'),
    ])
    expect(a).toBe(b)
  })
})
