import { normalizarCnpj } from './cnpj'

export const POR_PAGINA = 50

// Um termo de busca não é um documento. O corte existe para o parâmetro que vai
// ao banco ter tamanho conhecido, não para proteger o LIKE.
export const MAX_TERMO = 100

export type Consulta = {
  // O que a pessoa digitou: volta no campo de busca e nos links de paginação.
  termo: string
  // O mesmo termo com os metacaracteres de LIKE escapados: é este que vai ao SQL.
  padrao: string
  // Não nulo só quando o termo é um CNPJ inteiro. Vira condição de igualdade.
  cnpj: string | null
  pagina: number
}

type Params = Record<string, string | string[] | undefined>

function primeiro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? ''
  return valor ?? ''
}

// `%`, `_` e a própria `\` são metacaracteres de LIKE. Sem escapar, digitar `%`
// na busca casa a base inteira. A barra vem primeiro, senão ela escaparia as
// barras que este próprio replace acabou de inserir.
export function escaparLike(termo: string): string {
  return termo.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&')
}

export function lerConsulta(params: Params): Consulta {
  const termo = primeiro(params.q).trim().slice(0, MAX_TERMO)
  const pagina = Number(primeiro(params.pagina))
  return {
    termo,
    padrao: escaparLike(termo),
    // normalizarCnpj devolve null para tudo que não tem os 14 caracteres, então
    // '1122' não vira condição nenhuma — e é assim que a busca por CNPJ fica
    // exata sem depender de o SQL se lembrar disso.
    cnpj: normalizarCnpj(termo),
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  }
}

export function totalDePaginas(total: number): number {
  return Math.max(1, Math.ceil(total / POR_PAGINA))
}
