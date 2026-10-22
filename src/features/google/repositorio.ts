import { comoUsuario } from '@/src/server/db/como-usuario'
import type { PlanoEntrada, PlanoGoogle, ResultadoGoogle } from './tipos'

const PLANOS = `SELECT p.id,p.vendedor_id,u.nome AS vendedor,to_char(p.dia,'YYYY-MM-DD') AS dia,p.nicho,p.bairro,p.cidade,p.uf,p.estado,
  p.snapshot,p.motivo,p.iniciado_em::text,p.concluido_em::text,
  count(r.id)::int AS encontradas,
  count(r.id) FILTER (WHERE r.situacao='entregue')::int AS entregues,
  count(r.id) FILTER (WHERE r.situacao='entregue' AND EXISTS (SELECT 1 FROM contato c
    WHERE c.empresa_id=r.empresa_id AND c.criado_por=p.vendedor_id AND c.criado_em>=r.entregue_em))::int AS trabalhadas,
  count(r.id) FILTER (WHERE r.situacao IN ('pendente','conflito'))::int AS pendentes,
  count(r.id) FILTER (WHERE r.situacao IN ('indisponivel','repetida'))::int AS indisponiveis
  FROM google_planejamento p JOIN usuario u ON u.id=p.vendedor_id LEFT JOIN google_resultado r ON r.planejamento_id=p.id`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function repositorioGoogle(usuarioId: string) {
  return {
    async historicoEmpresa(empresaId: string) {
      if (!UUID.test(empresaId)) return []
      return comoUsuario(usuarioId, async e => (await e<{ pedidoId: string; dia: string; vendedor: string; nicho: string; situacao: string }>(`
        SELECT p.id AS "pedidoId",to_char(p.dia,'YYYY-MM-DD') AS dia,u.nome AS vendedor,p.nicho,r.situacao
        FROM google_resultado r JOIN google_planejamento p ON p.id=r.planejamento_id JOIN usuario u ON u.id=p.vendedor_id
        JOIN empresa alvo ON alvo.id=$1
        LEFT JOIN empresa por_cnpj ON por_cnpj.cnpj=nullif(r.dados->>'cnpj','')
        LEFT JOIN empresa_origem_google por_google ON por_google.google_place_id=nullif(r.dados->>'google_place_id','')
        WHERE eh_gestor() AND (r.empresa_id=alvo.id OR (r.empresa_id IS NULL AND r.situacao='pendente'
          AND (por_cnpj.id=alvo.id OR por_google.empresa_id=alvo.id)
          AND (por_cnpj.id IS NULL OR por_cnpj.id=alvo.id)
          AND (por_google.empresa_id IS NULL OR por_google.empresa_id=alvo.id)
          AND (por_google.empresa_id IS NULL OR nullif(r.dados->>'cnpj','') IS NULL OR alvo.cnpj=r.dados->>'cnpj')))
        ORDER BY p.dia DESC,p.criado_em DESC,p.id,r.indice`, [empresaId])).linhas)
    },
    async planejar(plano: PlanoEntrada): Promise<{ ok: true } | { ok: false; motivo: string }> {
      try {
        await comoUsuario(usuarioId, e => e('SELECT google_planejar($1,$2,$3,$4,$5)', [plano.dia, plano.nicho, plano.bairro, plano.cidade, plano.uf]))
        return { ok: true }
      } catch (erro) {
        const codigo = (erro as { code?: string }).code
        if (codigo === '55000') return { ok: false, motivo: 'O agente já iniciou os pedidos deste dia. Planeje os próximos dias.' }
        if (codigo === '42501') return { ok: false, motivo: 'Seu acesso não permite salvar o planejamento.' }
        if (codigo === '22023') return { ok: false, motivo: 'Confira a data e os critérios. Dias passados não podem ser alterados.' }
        throw erro
      }
    },
    async semana(inicio: string, fim: string, vendedor?: string): Promise<PlanoGoogle[]> {
      return comoUsuario(usuarioId, async e => (await e<PlanoGoogle>(`${PLANOS}
        WHERE p.dia BETWEEN $1::date AND $2::date AND ($3::uuid IS NULL OR p.vendedor_id=$3::uuid)
        GROUP BY p.id,u.nome ORDER BY p.dia,u.nome,p.id`, [inicio, fim, vendedor && UUID.test(vendedor) ? vendedor : null])).linhas)
    },
    async rotina(dia: string): Promise<boolean> {
      return comoUsuario(usuarioId, async e => (await e<{ iniciada: boolean }>('SELECT EXISTS(SELECT 1 FROM google_rotina WHERE dia=$1::date) AS iniciada', [dia])).linhas[0].iniciada)
    },
    async detalhe(id: string, pagina = 1) {
      if (!UUID.test(id)) return null
      if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100) throw new RangeError('Página de resultados inválida')
      return comoUsuario(usuarioId, async e => {
        const plano = (await e<PlanoGoogle>(`${PLANOS} WHERE p.id=$1 GROUP BY p.id,u.nome`, [id])).linhas[0]
        if (!plano) return null
        const resultados = (await e<ResultadoGoogle>(`SELECT r.id,r.empresa_id,r.situacao,r.dados,r.motivo,r.entregue_em::text,
          EXISTS (SELECT 1 FROM contato c WHERE c.empresa_id=r.empresa_id AND c.criado_por=$2 AND c.criado_em>=r.entregue_em) AS trabalhada
          FROM google_resultado r WHERE r.planejamento_id=$1 ORDER BY r.indice LIMIT 51 OFFSET $3`, [id, plano.vendedor_id, (pagina - 1) * 50])).linhas
        const recibo = (await e<{ recibo: Record<string, unknown> }>('SELECT recibo FROM google_publicacao WHERE planejamento_id=$1', [id])).linhas[0]?.recibo ?? null
        return { plano, resultados: resultados.slice(0, 50), recibo, pagina, temProxima: resultados.length > 50 }
      })
    },
    async vendedores() {
      return comoUsuario(usuarioId, async e => (await e<{ id: string; nome: string }>("SELECT id,nome FROM usuario u WHERE eh_gestor() AND (papel='vendedor' OR EXISTS(SELECT 1 FROM google_planejamento p WHERE p.vendedor_id=u.id)) ORDER BY nome,id")).linhas)
    },
    async proximo(): Promise<PlanoGoogle | null> {
      return comoUsuario(usuarioId, async e => (await e<{ pedido: PlanoGoogle | null }>('SELECT google_agente_proximo() AS pedido')).linhas[0].pedido)
    },
    async etapa(id: string, estado: string, motivo: string | null) {
      await comoUsuario(usuarioId, e => e('SELECT google_agente_etapa($1,$2,$3)', [id, estado, motivo]))
    },
    async entregar(id: string, empresas: Record<string, unknown>[], recibo: Record<string, unknown>) {
      return comoUsuario(usuarioId, async e => (await e<{ resultado: string }>('SELECT google_agente_entregar($1,$2,$3) AS resultado',
        [id, JSON.stringify(empresas), JSON.stringify(recibo)])).linhas[0].resultado)
    },
  }
}
