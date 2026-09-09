import { describe, expect, test } from 'vitest'
import type { LinhaCep } from '@/src/server/cep/linha'
import { lerZip } from '@/src/server/cep/zip'

const FIXTURE = 'tests/fixtures/cep-mini.zip'

describe('lerZip', () => {
  test('lê as doze entradas, inclusive a repetida', async () => {
    const lidas: LinhaCep[] = []
    const r = await lerZip(FIXTURE, (l) => lidas.push(l))
    expect(r).toEqual({ lidas: 12, descartadas: 0 })
    expect(lidas).toHaveLength(12)
    expect(new Set(lidas.map((l) => l.cep)).size).toBe(11)
  })

  test('traduz complemento em faixa e vazio em null', async () => {
    const lidas: LinhaCep[] = []
    await lerZip(FIXTURE, (l) => lidas.push(l))
    expect(lidas.find((l) => l.cep === '01001000')).toMatchObject({ faixa: 'lado par' })
    expect(lidas.find((l) => l.cep === '69900001')).toMatchObject({
      logradouro: null,
      faixa: null,
      bairro: null,
      localidade: 'Rio Branco',
    })
  })

  test('acento sobrevive: o arquivo é UTF-8', async () => {
    const lidas: LinhaCep[] = []
    await lerZip(FIXTURE, (l) => lidas.push(l))
    expect(lidas.find((l) => l.cep === '88010000')?.localidade).toBe('Florianópolis')
  })

  test('zip inexistente rejeita, não devolve zero linhas', async () => {
    await expect(lerZip('tests/fixtures/nao-existe.zip', () => {})).rejects.toThrow()
  })
})
