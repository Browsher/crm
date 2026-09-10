import { comoUsuario, type Executar } from '../../server/db/como-usuario'
import type { Validado } from './regras'

export type Motivo = 'sem_permissao' | 'nao_encontrada' | 'reserva_expirada' | 'ja_e_sua'
export type Falha = { ok: false; motivo: Motivo }

export class ResultadoDesconhecido extends Error {
  constructor(funcao: string, valor: string) {
    super(`${funcao} devolveu valor fora do vocabulário: ${JSON.stringify(valor)}`)
    this.name = 'ResultadoDesconhecido'
  }
}

// Object.hasOwn, não indexação direta, para 'toString' não virar resultado.
// Valor fora daqui é defeito nosso, não estado de negócio: lança.
const VOCABULARIO: Record<string, { ok: true } | Falha> = {
  ok: { ok: true },
  nao_encontrada: { ok: false, motivo: 'nao_encontrada' },
  reserva_expirada: { ok: false, motivo: 'reserva_expirada' },
  ja_e_sua: { ok: false, motivo: 'ja_e_sua' },
}

export function traduzirResultado(funcao: string, valor: string): { ok: true } | Falha {
  if (!Object.hasOwn(VOCABULARIO, valor)) throw new ResultadoDesconhecido(funcao, valor)
  return VOCABULARIO[valor]
}

// Único sinal de negócio que o banco produz por código: recusa de permissão.
// Senha provisória pendente e empresa que não está com você chegam os dois
// como 42501, de propósito — o repositório traduz um só.
function traduzirErro(erro: unknown): Falha | null {
  if ((erro as { code?: string })?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
  return null
}

async function tentar<T>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>): Promise<T | Falha> {
  try {
    return await comoUsuario(usuarioId, trabalho)
  } catch (erro) {
    const falha = traduzirErro(erro)
    if (falha) return falha
    throw erro
  }
}

export function registrarContato(
  usuarioId: string,
  empresaId: string,
  v: Validado,
): Promise<{ ok: true } | Falha> {
  return tentar(usuarioId, async (executar) => {
    const r = await executar<{ contato_registrar: string }>(
      'SELECT contato_registrar($1, $2, $3, $4, $5, $6)',
      [empresaId, v.tipo, v.nota, v.proximoPasso, v.proximoPassoData, v.desfecho],
    )
    return traduzirResultado('contato_registrar', r.linhas[0].contato_registrar)
  })
}
