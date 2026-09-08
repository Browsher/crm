import type { QueryResultRow } from 'pg'
import { conectarVerificado } from './pool'

export type Executar = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  parametros?: unknown[],
) => Promise<{ linhas: T[]; afetadas: number }>

export class ExecutarForaDaTransacao extends Error {
  constructor() {
    super('executar foi chamado depois que comoUsuario retornou. Guardar a referência é vazamento de conexão.')
    this.name = 'ExecutarForaDaTransacao'
  }
}

export class UsuarioIdInvalido extends Error {
  constructor(valor: string) {
    super(`usuarioId não é um UUID: ${JSON.stringify(valor)}`)
    this.name = 'UsuarioIdInvalido'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Único caminho para dado de domínio. Abre transação, injeta identidade e
// papel numa ida só, entrega `executar`, e desfaz tudo no fim.
// O terceiro parâmetro existe para o harness de teste; a aplicação nunca passa.
export async function comoUsuario<T>(
  usuarioId: string,
  trabalho: (executar: Executar) => Promise<T>,
  url?: string,
): Promise<T> {
  if (!UUID.test(usuarioId)) throw new UsuarioIdInvalido(usuarioId)

  const cliente = await conectarVerificado(url)
  let encerrada = false
  let conexaoSuja = false

  const executar: Executar = async (sql, parametros) => {
    if (encerrada) throw new ExecutarForaDaTransacao()
    const r = await cliente.query(sql, parametros)
    return { linhas: r.rows, afetadas: r.rowCount ?? 0 }
  }

  try {
    await cliente.query('BEGIN')
    // set_config(..., true) é SET LOCAL em forma de função: aceita parâmetro e
    // volta sozinho no COMMIT ou no ROLLBACK. `role` é parâmetro comum.
    await cliente.query(
      "SELECT set_config('app.usuario_id', $1, true), set_config('role', 'app_usuario', true)",
      [usuarioId],
    )
    const resultado = await trabalho(executar)
    await cliente.query('COMMIT')
    return resultado
  } catch (erro) {
    try {
      await cliente.query('ROLLBACK')
    } catch {
      conexaoSuja = true
    }
    throw erro
  } finally {
    encerrada = true
    if (conexaoSuja) {
      cliente.release(new Error('rollback falhou; conexão descartada'))
    } else {
      // RESET ALL não restaura `role` (GUC_NO_RESET_ALL); por isso o RESET ROLE explícito.
      await cliente.query('RESET ROLE')
      await cliente.query('RESET ALL')
      cliente.release()
    }
  }
}
