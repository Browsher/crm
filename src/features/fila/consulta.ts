import { resolverCeps, type Endereco } from '../../server/cep/resolver'
import { comoUsuario } from '../../server/db/como-usuario'
import type { Falha } from './repositorio'

export type EmpresaComigo = {
  id: string
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  contatoNome: string | null
  telefone: string
  email: string | null
  // Os três estados de endereço, separados: com endereço, com CEP que a base
  // não resolveu, e sem CEP nenhum. A tela diz coisas diferentes para cada um.
  cep: string | null
  endereco: Endereco | null
  // Não nulo só na reserva. A tela conta o tempo a partir daqui — nenhuma
  // constante de prazo existe em TypeScript.
  reservadoAte: Date | null
  posse: boolean
  // Derivado do contato mais recente, sem cache: `contato` é a verdade, e duas
  // fontes para o mesmo dado sempre divergem. `vencido` é calculado no banco,
  // em data civil de São Paulo — nenhuma comparação de data em TypeScript.
  proximoPasso: string | null
  proximoPassoData: string | null
  vencido: boolean
}

export type ResultadoMinhasEmpresas = { ok: true; reserva: EmpresaComigo | null; carteira: EmpresaComigo[] } | Falha

type LinhaCrua = {
  id: string
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  contato_nome: string | null
  telefone: string
  email: string | null
  cep: string | null
  reservado_ate: Date | null
  posse: boolean
  proximo_passo: string | null
  proximo_passo_data: string | null
  vencido: boolean
}

// A reserva vigente e a carteira numa consulta só: são a mesma pergunta ("o
// que está comigo?") e duas idas responderiam em instantes diferentes.
//
// A RLS já filtra por `usuario_atual()`, e o `WHERE` repete o filtro de
// propósito: a política deixa passar reserva EXPIRADA (ela some da leitura de
// `empresa`, não da linha de fila), e reserva expirada não está com ninguém.
// O LEFT JOIN LATERAL traz o contato mais recente por empresa; `c.id DESC` é
// desempate estável, porque `criado_em` vem de now() (início da transação) e
// ordem sem terceira chave vira sorteio quando há empate.
//
// A ordem é `proximo_passo_data ASC NULLS LAST`: vencido cai no topo sozinho,
// porque data menor vem antes. NULLS LAST é decisão — empresa sem próximo
// passo precisa de atenção, mas menos que um combinado vencido há três dias.
const SQL = `SELECT e.id, e.cnpj, e.razao_social, e.nome_fantasia, e.contato_nome, e.telefone, e.email, e.cep,
                    f.reservado_ate, f.vendedor_id IS NOT NULL AS posse,
                    ultimo.proximo_passo,
                    to_char(ultimo.proximo_passo_data, 'YYYY-MM-DD') AS proximo_passo_data,
                    coalesce(ultimo.proximo_passo_data < (now() AT TIME ZONE 'America/Sao_Paulo')::date, false) AS vencido
               FROM empresa_fila f
               JOIN empresa e ON e.id = f.empresa_id
               LEFT JOIN LATERAL (
                 SELECT c.proximo_passo, c.proximo_passo_data
                   FROM contato c
                  WHERE c.empresa_id = e.id
                  ORDER BY c.criado_em DESC, c.id DESC
                  LIMIT 1
               ) ultimo ON true
              WHERE f.vendedor_id = $1
                 OR (f.reservado_por = $1 AND f.reservado_ate > now())
              ORDER BY ultimo.proximo_passo_data ASC NULLS LAST, e.razao_social, e.id`

export async function lerMinhasEmpresas(usuarioId: string): Promise<ResultadoMinhasEmpresas> {
  try {
    return await comoUsuario(usuarioId, async (executar) => {
      const r = await executar<LinhaCrua>(SQL, [usuarioId])
      const ceps = [...new Set(r.linhas.map((l) => l.cep).filter((c): c is string => c !== null))]
      const enderecos = await resolverCeps(executar, ceps)
      const todas = r.linhas.map((l) => ({
        id: l.id,
        cnpj: l.cnpj,
        razaoSocial: l.razao_social,
        nomeFantasia: l.nome_fantasia,
        contatoNome: l.contato_nome,
        telefone: l.telefone,
        email: l.email,
        cep: l.cep,
        endereco: l.cep ? enderecos.get(l.cep) ?? null : null,
        reservadoAte: l.reservado_ate,
        posse: l.posse,
        proximoPasso: l.proximo_passo,
        proximoPassoData: l.proximo_passo_data,
        vencido: l.vencido,
      }))
      return {
        ok: true as const,
        // No máximo uma reserva por vendedor: é o desenho da fila, garantido
        // pelo `UPDATE` de liberação em `fila_puxar`.
        reserva: todas.find((x) => !x.posse) ?? null,
        carteira: todas.filter((x) => x.posse),
      }
    })
  } catch (erro) {
    if ((erro as { code?: string })?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}
