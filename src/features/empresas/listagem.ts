import { comoUsuario } from '../../server/db/como-usuario'
import { POR_PAGINA, type Consulta } from './consulta'
import type { Falha } from './repositorio'

export type EmpresaNaLista = {
  id: string
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  telefone: string
  email: string | null
  // Os três estados de endereço, separados de propósito: com cidade, com CEP
  // que a base não resolveu, e sem CEP nenhum. A tela diz coisas diferentes
  // para cada um — é a lição de "Fatia empresas: o terceiro estado do CEP".
  cep: string | null
  localidade: string | null
  uf: string | null
}

export type ResultadoListagem = { ok: true; linhas: EmpresaNaLista[]; total: number } | Falha

type LinhaCrua = {
  id: string
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  telefone: string
  email: string | null
  cep: string | null
  localidade: string | null
  uf: string | null
  total: string
}

// Uma consulta só. `count(*) OVER ()` traz o total do filtro junto com a
// página, em vez de uma segunda ida ao banco que responderia outra pergunta num
// instante diferente.
//
// `ORDER BY` termina em `id` de propósito: duas empresas com a mesma razão
// social deixam a ordem indefinida entre um LIMIT/OFFSET e o seguinte, e a
// página 2 repete ou pula linha.
//
// LIMITE HONESTO, medido em 2026-09-09: o teste de paginação **passa sem o
// desempate**. Com esta tabela e este plano de consulta, o Postgres devolve
// ordem estável por acaso. O `, e.id` está aqui porque o SQL não promete nada,
// não porque um teste o cobrou — e um teste que dependesse de plano de consulta
// para falhar seria pior que nenhum.
//
// `ESCAPE '\'` **repete o padrão do Postgres**, que já é a barra invertida.
// Está escrito para quem lê não precisar saber disso de cor. Quem faz o
// trabalho de verdade é `escaparLike` em consulta.ts: sem ela, `_` digitado
// casa qualquer caractere (medido: o teste do `_` falha, o do `%` passa por
// acaso, porque `%100%%` ainda só acha quem tem "100").
//
// O CNPJ é PREFIXO ANCORADO (`cnpj LIKE $2 || '%'`), nunca substring, e nunca
// dentro de `busca`. A distinção é o que a spec quis dizer com "exata": o medo
// dela era `'1122'` casando pedaço de CNPJ de empresa nenhuma a ver, contaminado
// pelo nome fantasia da vizinha. Ancorado na própria coluna e a partir da raiz
// de oito, `44555666` acha os estabelecimentos de UMA empresa — que é a
// pergunta que quem digita a raiz está fazendo.
//
// `$2` já vem filtrado para [0-9A-Z] por prefixoCnpj, então nenhum
// metacaractere de LIKE chega aqui e ele não precisa de escape. Nulo vira
// `NULL || '%'` = NULL, que nunca é verdadeiro: sem termo de CNPJ, a condição
// simplesmente não existe.
//
// O corte é no banco, não no Node: com milhares de linhas, trazer tudo para
// filtrar em memória é o erro que a paginação existe para não cometer.
const SQL = `SELECT e.id, e.cnpj, e.razao_social, e.nome_fantasia, e.telefone, e.email, e.cep,
                    c.localidade, c.uf, count(*) OVER () AS total
               FROM empresa e
               LEFT JOIN cep c ON c.cep = e.cep
              WHERE $1::text = ''
                 OR e.busca LIKE '%' || sem_acento($1::text) || '%' ESCAPE '\\'
                 OR e.cnpj LIKE $2::text || '%'
              ORDER BY e.razao_social, e.id
              LIMIT $3 OFFSET $4`

export async function listarEmpresas(gestorId: string, consulta: Consulta): Promise<ResultadoListagem> {
  try {
    return await comoUsuario(gestorId, async (executar) => {
      const r = await executar<LinhaCrua>(SQL, [
        consulta.padrao,
        consulta.cnpjPrefixo,
        POR_PAGINA,
        (consulta.pagina - 1) * POR_PAGINA,
      ])
      return {
        ok: true as const,
        // count(*) OVER () vem como bigint, que o pg entrega em texto. Sem
        // linha nenhuma não há janela, e o total é zero.
        total: r.linhas.length > 0 ? Number(r.linhas[0].total) : 0,
        linhas: r.linhas.map((l) => ({
          id: l.id,
          cnpj: l.cnpj,
          razaoSocial: l.razao_social,
          nomeFantasia: l.nome_fantasia,
          telefone: l.telefone,
          email: l.email,
          cep: l.cep,
          localidade: l.localidade,
          uf: l.uf,
        })),
      }
    })
  } catch (erro) {
    // Único sinal de negócio que esta consulta produz: papel trocado entre a
    // guarda da página e a consulta. O resto é infraestrutura e sobe como
    // exceção.
    if ((erro as { code?: string })?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}
