import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { ExecutarForaDaTransacao, type Executar } from '@/src/server/db/como-usuario'
import { conectarVerificado } from '@/src/server/db/pool'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedorA: string
let vendedorB: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestora')
  vendedorA = await criarUsuario(banco, 'vendedor', 'VendedorA')
  vendedorB = await criarUsuario(banco, 'vendedor', 'VendedorB')
})
afterAll(async () => {
  await banco.derrubar()
})

const quemSou = async (executar: Executar) => {
  const { linhas } = await executar<{ id: string | null; papel: string }>(
    'SELECT usuario_atual() AS id, current_user AS papel',
  )
  return linhas[0]
}

describe('identidade dentro da transação', () => {
  test('usuario_atual() devolve o id passado e o papel é app_usuario', async () => {
    const r = await banco.comoUsuario(vendedorA, quemSou)
    expect(r).toEqual({ id: vendedorA, papel: 'app_usuario' })
  })

  test('vendedor vê só a si; gestor vê todos', async () => {
    const meus = await banco.comoUsuario(vendedorA, async (e) => (await e<{ id: string }>('SELECT id FROM usuario')).linhas)
    expect(meus.map((x) => x.id)).toEqual([vendedorA])
    const todos = await banco.comoUsuario(gestor, async (e) => (await e('SELECT id FROM usuario')).afetadas)
    expect(todos).toBe(3)
  })

  test('alternância de usuários na mesma conexão sem contaminação', async () => {
    const ids = [vendedorA, vendedorB, gestor]
    for (let i = 0; i < 10; i++) {
      const id = ids[i % 3]
      const r = await banco.comoUsuario(id, quemSou)
      expect(r.id).toBe(id)
    }
  })
})

describe('identidade não sobrevive à transação', () => {
  test('fora de comoUsuario, a variável e o papel voltam ao padrão', async () => {
    await banco.comoUsuario(vendedorA, quemSou)
    const c = await conectarVerificado(banco.urlApp)
    try {
      // current_setting de variável nunca definida devolve NULL; depois de definida e revertida devolve ''.
      const { rows } = await c.query(
        "SELECT COALESCE(current_setting('app.usuario_id', true), '') AS id, current_user AS papel",
      )
      expect(rows[0]).toEqual({ id: '', papel: 'app_conexao' })
    } finally {
      c.release()
    }
  })

  test('controle negativo: SET sem LOCAL vaza para a próxima transação', async () => {
    const c = await conectarVerificado(banco.urlApp)
    try {
      await c.query("SET app.usuario_id = 'vazou'")
      const { rows } = await c.query("SELECT current_setting('app.usuario_id', true) AS id")
      expect(rows[0].id).toBe('vazou')
      await c.query('RESET ALL')
    } finally {
      c.release()
    }
  })

  test('controle negativo: RESET ALL sozinho não derruba SET ROLE sem LOCAL', async () => {
    const c = await conectarVerificado(banco.urlApp)
    try {
      await c.query('SET ROLE app_usuario')
      await c.query('RESET ALL')
      const { rows } = await c.query('SELECT current_user AS papel')
      expect(rows[0].papel).toBe('app_usuario')
      await c.query('RESET ROLE')
      const depois = await c.query('SELECT current_user AS papel')
      expect(depois.rows[0].papel).toBe('app_conexao')
    } finally {
      c.release()
    }
  })
})

describe('desfecho da transação', () => {
  test('papel e identidade voltam após COMMIT', async () => {
    await banco.comoUsuario(vendedorA, quemSou)
    const r = await banco.comoUsuario(vendedorB, quemSou)
    expect(r.id).toBe(vendedorB)
  })

  test('papel e identidade voltam após ROLLBACK provocado por erro no meio', async () => {
    await expect(
      banco.comoUsuario(vendedorA, async (e) => {
        await e('SELECT 1/0')
      }),
    ).rejects.toThrow(/division by zero/)
    const r = await banco.comoUsuario(vendedorB, quemSou)
    expect(r).toEqual({ id: vendedorB, papel: 'app_usuario' })
  })

  test('erro do trabalho desfaz a escrita', async () => {
    await expect(
      banco.comoUsuario(gestor, async (e) => {
        await e("INSERT INTO usuario (nome, email, papel) VALUES ('Tmp', 'tmp@teste.local', 'vendedor')")
        throw new Error('desisti')
      }),
    ).rejects.toThrow('desisti')
    const r = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM usuario WHERE email = 'tmp@teste.local'")
    expect(r[0].n).toBe(0)
  })
})

describe('herança de papel não vaza acesso', () => {
  test('app_conexao consultando usuario fora de comoUsuario recebe zero linhas ou erro, nunca dados', async () => {
    const c = await conectarVerificado(banco.urlApp)
    try {
      const r = await c.query('SELECT id FROM usuario').catch((e: unknown) => e as Error & { code?: string })
      if (r instanceof Error) {
        expect(r.code).toBe('42501')
      } else {
        expect(r.rowCount).toBe(0)
      }
    } finally {
      c.release()
    }
  })
})

describe('vazamento do lado JavaScript', () => {
  test('executar guardado lança ExecutarForaDaTransacao depois do retorno', async () => {
    let guardado: Executar | undefined
    await banco.comoUsuario(vendedorA, async (e) => {
      guardado = e
    })
    await expect(guardado!('SELECT 1')).rejects.toBeInstanceOf(ExecutarForaDaTransacao)
  })
})
