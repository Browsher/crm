import type { QueryResultRow } from 'pg'
import { conectarVerificado } from './pool'

// Único caminho para o banco sem identidade: chamar uma função SECURITY
// DEFINER de `autenticacao` como app_conexao. Não existe `executar` aqui, de
// propósito. Quem precisar de SQL livre sem identidade está pedindo a coisa
// errada; o mapa abaixo é a lista fechada, e o GRANT no banco é a mesma lista.
export const FUNCOES = {
  credencial_por_email: 1,
  bloqueio_login: 2,
  registrar_tentativa_login: 3,
  sessao_criar: 4,
  sessao_atual: 1,
  sessao_encerrar: 1,
  senha_trocar: 2,
} as const

export type NomeFuncao = keyof typeof FUNCOES
type Tupla<N extends number, R extends unknown[] = []> = R['length'] extends N ? R : Tupla<N, [...R, unknown]>
export type Args<N extends NomeFuncao> = Tupla<(typeof FUNCOES)[N]>

export class FuncaoDesconhecida extends Error {
  constructor(nome: string) {
    super(`função fora do mapa de sem-identidade: ${JSON.stringify(nome)}`)
    this.name = 'FuncaoDesconhecida'
  }
}

export class AridadeInvalida extends Error {
  constructor(nome: string, esperada: number, recebida: number) {
    super(`autenticacao.${nome} recebe ${esperada} argumento(s), recebeu ${recebida}`)
    this.name = 'AridadeInvalida'
  }
}

export async function chamar<N extends NomeFuncao, T extends QueryResultRow = QueryResultRow>(
  nome: N,
  args: Args<N>,
): Promise<T[]> {
  if (!Object.hasOwn(FUNCOES, nome)) throw new FuncaoDesconhecida(String(nome))
  const aridade: number = FUNCOES[nome]
  const valores = args as unknown[]
  if (valores.length !== aridade) throw new AridadeInvalida(nome, aridade, valores.length)
  const marcadores = Array.from({ length: aridade }, (_, i) => `$${i + 1}`).join(', ')
  const cliente = await conectarVerificado()
  try {
    // `nome` vem do mapa, nunca de fora. Os valores vão sempre como parâmetro.
    const r = await cliente.query<T>(`SELECT * FROM autenticacao.${nome}(${marcadores})`, valores)
    return r.rows
  } finally {
    cliente.release()
  }
}
