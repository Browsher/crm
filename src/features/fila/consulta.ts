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
}

// A reserva vigente e a carteira numa consulta só: são a mesma pergunta ("o
// que está comigo?") e duas idas responderiam em instantes diferentes.
//
// A RLS já filtra por `usuario_atual()`, e o `WHERE` repete o filtro de
// propósito: a política deixa passar reserva EXPIRADA (ela some da leitura de
// `empresa`, não da linha de fila), e reserva expirada não está com ninguém.
const SQL = `SELECT e.id, e.cnpj, e.razao_social, e.nome_fantasia, e.contato_nome, e.telefone, e.email, e.cep,
                    f.reservado_ate, f.vendedor_id IS NOT NULL AS posse
               FROM empresa_fila f
               JOIN empresa e ON e.id = f.empresa_id
              WHERE f.vendedor_id = $1
                 OR (f.reservado_por = $1 AND f.reservado_ate > now())
              ORDER BY e.razao_social, e.id`

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
