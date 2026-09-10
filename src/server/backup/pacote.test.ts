import { randomBytes } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { cifrar, decifrar, selecionarExpirados } from './pacote'

describe('pacote criptografado', () => {
  test.each([Buffer.from([0, 255, 1, 13, 10]), Buffer.alloc(0)])('recupera todos os bytes, inclusive conteúdo vazio (%j)', (origem) => {
    const chave = randomBytes(32)
    expect(decifrar(cifrar(origem, chave), chave)).toEqual(origem)
  })

  test('a mesma chave e conteúdo produzem pacotes distintos recuperáveis', () => {
    const chave = randomBytes(32)
    const origem = randomBytes(100)
    const primeiro = cifrar(origem, chave)
    const segundo = cifrar(origem, chave)
    expect(primeiro).not.toEqual(segundo)
    expect(decifrar(primeiro, chave)).toEqual(origem)
    expect(decifrar(segundo, chave)).toEqual(origem)
  })

  test('não devolve conteúdo com chave errada', () => {
    const pacote = cifrar(Buffer.from('conteúdo privado'), randomBytes(32))
    expect(() => decifrar(pacote, randomBytes(32))).toThrow()
  })

  test.each([0, 16, 31, 33, 64])('recusa chave de %i bytes na cifra e decifra', (tamanho) => {
    const chave = Buffer.alloc(tamanho)
    expect(() => cifrar(Buffer.from('x'), chave)).toThrow()
    const pacote = cifrar(Buffer.from('x'), randomBytes(32))
    expect(() => decifrar(pacote, chave)).toThrow()
  })

  test('recusa adulteração de qualquer byte: cabeçalho, nonce, ciphertext e tag', () => {
    const chave = randomBytes(32)
    const pacote = cifrar(Buffer.from('conteúdo privado'), chave)
    for (let posicao = 0; posicao < pacote.length; posicao++) {
      const adulterado = Buffer.from(pacote)
      adulterado[posicao] ^= 1
      expect(() => decifrar(adulterado, chave), `byte ${posicao}`).toThrow()
    }
    expect(decifrar(pacote, chave)).toEqual(Buffer.from('conteúdo privado'))
  })

  test('recusa qualquer truncamento ou byte excedente', () => {
    const chave = randomBytes(32)
    const pacote = cifrar(Buffer.from([0, 255, 1, 13, 10]), chave)
    for (let tamanho = 0; tamanho < pacote.length; tamanho++) {
      expect(() => decifrar(pacote.subarray(0, tamanho), chave)).toThrow()
    }
    expect(() => decifrar(Buffer.concat([pacote, Buffer.from([0])]), chave)).toThrow()
  })
})

describe('selecionarExpirados', () => {
  const antigo = 'crm-backup-2025-12-31T23-59-59-999Z-ff.crmbackup'
  const medio = 'crm-backup-2026-01-01T00-00-00-000Z-aa.crmbackup'
  const recente = 'crm-backup-2026-09-10T18-00-00-000Z-00.crmbackup'

  test('seleciona os antigos por data sem modificar a lista recebida', () => {
    const nomes = [medio, recente, antigo]
    expect(selecionarExpirados(nomes, 1)).toEqual([antigo, medio])
    expect(nomes).toEqual([medio, recente, antigo])
    expect(selecionarExpirados(nomes, 3)).toEqual([])
    expect(selecionarExpirados([], 14)).toEqual([])
  })

  test('preserva nomes alheios, caminhos, temporários e datas inválidas', () => {
    const alheios = [
      'foto.jpg', `../${antigo}`, `pasta\\${antigo}`, `${antigo}.tmp`,
      'crm-backup-2026-02-30T18-00-00-000Z-aa.crmbackup',
      'crm-backup-2026-09-10T24-00-00-000Z-aa.crmbackup',
      'crm-backup-2026-09-10T18-00-00-000Z-xyz.crmbackup',
      'crm-backup-2026-09-10T18-00-00-000Z-.crmbackup',
      'crm-backup-2026-09-10T18-00-00-000Z-AA.crmbackup',
      `${antigo}\n`,
    ]
    expect(selecionarExpirados([...alheios, recente, antigo], 1)).toEqual([antigo])
  })

  test.each([0, -1, 1.5, NaN, Infinity])('recusa quantidade de retenção inválida: %s', (manter) => {
    expect(() => selecionarExpirados([antigo], manter)).toThrow()
  })
})
