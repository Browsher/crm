import { describe, expect, test } from 'vitest'
import { gerarHash, gerarSenhaProvisoria, hashDescartavel, MAXIMO, validarSenha, verificarSenha } from './senha'

describe('gerarHash e verificarSenha', () => {
  test('formato scrypt$N=131072,r=8,p=1$sal$chave e verificação confere', async () => {
    const hash = await gerarHash('correta-123')
    expect(hash).toMatch(/^scrypt\$N=131072,r=8,p=1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
    expect(await verificarSenha('correta-123', hash)).toBe(true)
    expect(await verificarSenha('errada-123', hash)).toBe(false)
  })

  test('mesma senha gera hashes diferentes (sal aleatório)', async () => {
    expect(await gerarHash('abcdefgh')).not.toBe(await gerarHash('abcdefgh'))
  })

  test('NFKC: formas Unicode equivalentes conferem', async () => {
    const hash = await gerarHash('café-senha')
    expect(await verificarSenha('café-senha', hash)).toBe(true)
  })

  test('hash malformado ou de algoritmo desconhecido não confere e não lança', async () => {
    expect(await verificarSenha('x', 'lixo')).toBe(false)
    expect(await verificarSenha('x', 'bcrypt$a$b$c')).toBe(false)
    expect(await verificarSenha('x', 'scrypt$N=abc,r=8,p=1$AAAA$BBBB')).toBe(false)
  })

  test('hashDescartavel é um hash real, reusado, que não confere com nada', async () => {
    const a = await hashDescartavel()
    expect(a).toBe(await hashDescartavel())
    expect(a).toMatch(/^scrypt\$/)
    expect(await verificarSenha('qualquer', a)).toBe(false)
  })
})

describe('validarSenha', () => {
  test('8 a 128 caracteres, não só espaço, diferente da atual', () => {
    expect(validarSenha('12345678')).toEqual({ ok: true })
    expect(validarSenha('1234567')).toEqual({ ok: false, faltas: ['minimo'] })
    expect(validarSenha('x'.repeat(MAXIMO + 1))).toEqual({ ok: false, faltas: ['maximo'] })
    expect(validarSenha('        ')).toEqual({ ok: false, faltas: ['so_espaco'] })
    expect(validarSenha('mesma-senha', 'mesma-senha')).toEqual({ ok: false, faltas: ['igual_atual'] })
    expect(validarSenha('       ', 'x')).toEqual({ ok: false, faltas: ['minimo', 'so_espaco'] })
  })
})

describe('gerarSenhaProvisoria', () => {
  test('três blocos de quatro, alfabeto sem 0 O 1 l I, passa na validação', () => {
    for (let i = 0; i < 50; i++) {
      const s = gerarSenhaProvisoria()
      expect(s).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/)
      expect(validarSenha(s)).toEqual({ ok: true })
    }
  })
})
