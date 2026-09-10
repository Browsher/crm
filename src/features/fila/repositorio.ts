import { comoUsuario, type Executar } from '../../server/db/como-usuario'

export type Motivo = 'sem_permissao' | 'nao_encontrada' | 'reserva_expirada' | 'ja_e_sua'
export type Falha = { ok: false; motivo: Motivo }

export class ResultadoDesconhecido extends Error {
  constructor(funcao: string, valor: string) {
    super(`${funcao} devolveu valor fora do vocabulário: ${JSON.stringify(valor)}`)
    this.name = 'ResultadoDesconhecido'
  }
}

// Vocabulário das funções de escrita da 0016. Object.hasOwn, não indexação
// direta, para 'toString' não virar resultado. Valor fora daqui é defeito
// nosso, não estado de negócio: lança em vez de virar { ok: false }.
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

// `empresaId` nulo é fila vazia, e não falha: a função devolveu zero linhas
// porque não há candidata. Quem decide o que dizer é a tela.
export function puxarProxima(usuarioId: string): Promise<{ ok: true; empresaId: string | null } | Falha> {
  return tentar(usuarioId, async (executar) => {
    const r = await executar<{ empresa_id: string }>('SELECT empresa_id FROM fila_puxar()')
    return { ok: true as const, empresaId: r.linhas[0]?.empresa_id ?? null }
  })
}

export function assumir(usuarioId: string, empresaId: string): Promise<{ ok: true } | Falha> {
  return tentar(usuarioId, async (executar) => {
    const r = await executar<{ empresa_assumir: string }>('SELECT empresa_assumir($1)', [empresaId])
    return traduzirResultado('empresa_assumir', r.linhas[0].empresa_assumir)
  })
}

export function devolver(usuarioId: string, empresaId: string): Promise<{ ok: true } | Falha> {
  return tentar(usuarioId, async (executar) => {
    const r = await executar<{ empresa_devolver: string }>('SELECT empresa_devolver($1)', [empresaId])
    return traduzirResultado('empresa_devolver', r.linhas[0].empresa_devolver)
  })
}
