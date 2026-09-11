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

export type FiltrosReserva = {
  nome: string
  cnae: string | null
  uf: string | null
  cidade: string | null
  bairro: string | null
}
export type ResultadoReserva = {
  ok: true
  resultado: 'ok' | 'sem_candidata' | 'indisponivel' | 'contexto_alterado'
  empresaId: string | null
  reservadoAte: Date | null
  contexto: string | null
} | Falha

export function reservarEmpresa(usuarioId: string, alvo: string | null, filtros: FiltrosReserva, contexto: string | null): Promise<ResultadoReserva> {
  return tentar(usuarioId, async executar => {
    const r = await executar<{
      resultado: string
      empresa_id: string | null
      reservado_ate: Date | null
      contexto: string | null
    }>('SELECT * FROM fila_reservar($1,$2,$3,$4,$5,$6,$7)', [alvo, filtros.nome, filtros.cnae, filtros.uf, filtros.cidade, filtros.bairro, contexto])
    const linha = r.linhas[0]
    if (!linha || !['ok', 'sem_candidata', 'indisponivel', 'contexto_alterado'].includes(linha.resultado)) {
      throw new ResultadoDesconhecido('fila_reservar', linha?.resultado ?? '')
    }
    return {
      ok: true as const,
      resultado: linha.resultado as 'ok' | 'sem_candidata' | 'indisponivel' | 'contexto_alterado',
      empresaId: linha.empresa_id,
      reservadoAte: linha.reservado_ate,
      contexto: linha.contexto,
    }
  })
}

// `assumir` e `devolver` saíram na 0019: as funções do banco viraram internas
// e o caminho da tela é `contato_registrar`, em src/features/contato.
