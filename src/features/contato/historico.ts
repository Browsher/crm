import { comoUsuario } from '../../server/db/como-usuario'
import type { Falha } from './repositorio'

export type Contato = {
  id: string
  tipo: string
  nota: string | null
  proximoPasso: string | null
  proximoPassoData: string | null
  criadoEm: Date
  autor: string | null
}

export type ResultadoHistorico = { ok: true; contatos: Contato[] } | Falha

type LinhaCrua = {
  id: string
  tipo: string
  nota: string | null
  proximo_passo: string | null
  proximo_passo_data: string | null
  criado_em: Date
  autor: string | null
}

// A RLS já filtra: quem não lê a empresa não lê o contato, e o resultado é
// lista vazia, não erro.
//
// `criado_em DESC, id DESC` é a ordem do índice, com desempate estável pelo
// mesmo motivo do `e.id ASC` da fila: `criado_em` vem de now(), que é o
// instante de início da transação, e ordem sem terceira chave vira sorteio
// quando há empate.
//
// `to_char` na data: `date` chega no pg como string em alguns caminhos e como
// Date em outros. Converter no SQL tira a ambiguidade do TypeScript, e nenhuma
// comparação de data acontece aqui.
const SQL = `SELECT c.id, c.tipo, c.nota, c.proximo_passo,
                    to_char(c.proximo_passo_data, 'YYYY-MM-DD') AS proximo_passo_data,
                    c.criado_em, u.nome AS autor
               FROM contato c
               LEFT JOIN usuario u ON u.id = c.criado_por
              WHERE c.empresa_id = $1
              ORDER BY c.criado_em DESC, c.id DESC`

export async function lerHistorico(usuarioId: string, empresaId: string): Promise<ResultadoHistorico> {
  try {
    return await comoUsuario(usuarioId, async (executar) => {
      const r = await executar<LinhaCrua>(SQL, [empresaId])
      return {
        ok: true as const,
        contatos: r.linhas.map((l) => ({
          id: l.id,
          tipo: l.tipo,
          nota: l.nota,
          proximoPasso: l.proximo_passo,
          proximoPassoData: l.proximo_passo_data,
          criadoEm: l.criado_em,
          autor: l.autor,
        })),
      }
    })
  } catch (erro) {
    if ((erro as { code?: string })?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}
