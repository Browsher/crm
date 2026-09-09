export const POR_PAGINA = 50

// As oito primeiras posições do CNPJ são a RAIZ: identificam a EMPRESA. As
// quatro seguintes são o estabelecimento (matriz `0001`, filiais `0002`…) e as
// duas últimas são os dígitos verificadores.
//
// Por isso oito é o piso, e não um número escolhido por gosto: abaixo da raiz o
// termo não identifica empresa nenhuma, e a partir dela identifica uma só — com
// todos os estabelecimentos dela junto, que é o que quem digita a raiz espera.
export const RAIZ_CNPJ = 8

// Um termo de busca não é um documento. O corte existe para o parâmetro que vai
// ao banco ter tamanho conhecido, não para proteger o LIKE.
export const MAX_TERMO = 100

export type Consulta = {
  // O que a pessoa digitou: volta no campo de busca e nos links de paginação.
  termo: string
  // O mesmo termo com os metacaracteres de LIKE escapados: é este que vai ao SQL.
  padrao: string
  // Não nulo quando o termo tem forma de CNPJ da raiz para cima. Vira prefixo
  // ANCORADO na coluna `cnpj` — nunca substring, nunca dentro de `busca`.
  cnpjPrefixo: string | null
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

// Normaliza o termo para a forma em que o CNPJ é GUARDADO — só dígitos e letras
// maiúsculas — e devolve null quando ele não serve como prefixo.
//
// `normalizarCnpj` não serve aqui e não deveria servir: ela exige os 14
// caracteres porque valida identidade para gravar. Buscar é outra pergunta, e
// foi juntar as duas que produziu o defeito de 2026-09-09 — digitar a raiz não
// achava nada, enquanto o CNPJ formatado achava, porque só o segundo chegava
// aos 14 depois de perder a pontuação.
//
// Os mesmos separadores de `normalizarCnpj`, de propósito: quem digita copiando
// da tela cola pontuação, e as duas funções têm que enxergar o mesmo texto.
//
// LIMITE DECLARADO: uma palavra de 8 a 14 letras sem acento — `ILUMINACAO` —
// passa no teste de forma e vira prefixo. Não casa CNPJ nenhum, a condição é
// ancorada e o texto continua sendo procurado em `busca` pelo outro lado do OR,
// então o custo é uma comparação a mais. Recusar isso exigiria decidir que CNPJ
// alfanumérico não se busca por raiz, e ele existe desde 2026-07-06.
export function prefixoCnpj(termo: string): string | null {
  const limpo = termo.replace(/[\s./-]/g, '').toUpperCase()
  if (limpo.length < RAIZ_CNPJ || limpo.length > 14) return null
  // Só [0-9A-Z]: nenhum metacaractere de LIKE sobrevive até a consulta, e por
  // isso o prefixo vai ao SQL sem escapar.
  return /^[0-9A-Z]+$/.test(limpo) ? limpo : null
}

export function lerConsulta(params: Params): Consulta {
  const termo = primeiro(params.q).trim().slice(0, MAX_TERMO)
  const pagina = Number(primeiro(params.pagina))
  return {
    termo,
    padrao: escaparLike(termo),
    cnpjPrefixo: prefixoCnpj(termo),
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  }
}

export function totalDePaginas(total: number): number {
  return Math.max(1, Math.ceil(total / POR_PAGINA))
}
