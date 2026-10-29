import type { ProgressoGoogle } from '@/src/lib/google/progresso'
import { comoUsuario } from '@/src/server/db/como-usuario'
import type { AgenteGoogle, PlanoEntrada, PlanoGoogle, ResultadoGoogle, ExecucaoGoogle, LoteGoogle } from './tipos'

const PLANOS = `SELECT p.id,p.vendedor_id,u.nome AS vendedor,to_char(p.dia,'YYYY-MM-DD') AS dia,p.nicho,p.bairro,p.cidade,p.uf,p.estado,
  p.criterios,p.revisao,(SELECT e.revisao FROM google_execucao e WHERE e.pedido_id=p.id) AS execucao_revisao,
  p.snapshot,p.motivo,p.iniciado_em::text,p.concluido_em::text,
  EXISTS (SELECT 1 FROM google_sincronizacao s WHERE s.pedido_id=p.id AND s.versao_confirmada=s.versao) AS sincronizado,
  (SELECT s.erro FROM google_sincronizacao s WHERE s.pedido_id=p.id) AS sincronizacao_erro,
  count(r.id)::int AS encontradas,
  count(r.id) FILTER (WHERE r.situacao='entregue')::int AS entregues,
  count(r.id) FILTER (WHERE r.situacao='entregue' AND EXISTS (SELECT 1 FROM contato c
    WHERE c.empresa_id=r.empresa_id AND c.criado_por=p.vendedor_id AND c.criado_em>=r.entregue_em))::int AS trabalhadas,
  count(r.id) FILTER (WHERE r.situacao IN ('pendente','conflito'))::int AS pendentes,
  count(r.id) FILTER (WHERE r.situacao IN ('indisponivel','repetida'))::int AS indisponiveis
  FROM google_planejamento p JOIN usuario u ON u.id=p.vendedor_id LEFT JOIN google_resultado r ON r.planejamento_id=p.id`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function repositorioGoogle(usuarioId: string) {
  async function alterarPlanejamento(sql: string, parametros: unknown[]): Promise<{ ok: true; ids: string[] } | { ok: false; motivo: string }> {
    try {
      const r = await comoUsuario(usuarioId, async e => (await e<{ r: { ids: string[] } }>(sql, parametros)).linhas[0].r)
      return { ok: true, ids: r.ids }
    } catch (erro) {
      const codigo = (erro as { code?: string }).code
      if (codigo === '42501') return { ok: false, motivo: 'Seu acesso não permite alterar este planejamento.' }
      if (codigo === '55000') return { ok: false, motivo: 'O planejamento de origem mudou. Atualize a página e tente novamente.' }
      if (codigo === '22023' || codigo === '23514') return { ok: false, motivo: 'Confira os critérios e os dias escolhidos. Hoje e dias anteriores não podem ser alterados.' }
      throw erro
    }
  }
  return {
    salvarSemana(dias: PlanoEntrada[]) {
      return alterarPlanejamento('SELECT google_planejamento_salvar_semana($1) AS r', [JSON.stringify(dias)])
    },
    copiarDia(origem: string, revisao: number, destinos: string[], campos: ('nicho' | 'criterios' | 'regiao')[]) {
      return alterarPlanejamento('SELECT google_planejamento_copiar($1,$2,$3,$4) AS r', [origem, revisao, destinos, campos])
    },
    async historicoPlanejamento(): Promise<PlanoGoogle[]> {
      return comoUsuario(usuarioId, async e => (await e<PlanoGoogle>(`${PLANOS} WHERE p.vendedor_id=$1 GROUP BY p.id,u.nome ORDER BY p.dia DESC`, [usuarioId])).linhas)
    },
    async reservarLote(pedido: string, executor: string, lote: Record<string, unknown>) {
      return comoUsuario(usuarioId, async e => (await e<{ r: Record<string, unknown> }>('SELECT google_agente_reservar_lote($1,$2,$3) AS r', [pedido, executor, JSON.stringify(lote)])).linhas[0].r)
    },
    async concluir(pedido: string, executor: string, motivo: string) {
      return comoUsuario(usuarioId, async e => (await e<{ r: Record<string, unknown> }>('SELECT google_agente_concluir($1,$2,$3) AS r', [pedido, executor, motivo])).linhas[0].r)
    },
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
    async planejar(plano: PlanoEntrada): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
      try {
        const id = await comoUsuario(usuarioId, async e => (await e<{id:string}>('SELECT google_planejar($1,$2,$3,$4,$5) AS id', [plano.dia, plano.nicho, plano.bairro, plano.cidade, plano.uf])).linhas[0].id)
        return { ok: true, id }
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
        const resultados = (await e<ResultadoGoogle>(`SELECT r.id,r.empresa_id,r.situacao,r.dados,r.motivo,r.entregue_em::text,r.lote_id,r.canais_verificados,
          EXISTS (SELECT 1 FROM contato c WHERE c.empresa_id=r.empresa_id AND c.criado_por=$2 AND c.criado_em>=r.entregue_em) AS trabalhada
          FROM google_resultado r WHERE r.planejamento_id=$1 ORDER BY r.indice LIMIT 51 OFFSET $3`, [id, plano.vendedor_id, (pagina - 1) * 50])).linhas
        const recibo = (await e<{ recibo: Record<string, unknown> }>('SELECT recibo FROM google_publicacao WHERE planejamento_id=$1', [id])).linhas[0]?.recibo ?? null
        const execucao = (await e<ExecucaoGoogle>('SELECT revisao,snapshot,analisadas,entregues,lotes_reservados,motivo_parada FROM google_execucao WHERE pedido_id=$1', [id])).linhas[0] ?? null
        const lotes = (await e<LoteGoogle>('SELECT id,ordinal,jsonb_array_length(candidatas) AS analisadas,recibo,resposta,concluido_em::text FROM google_lote WHERE pedido_id=$1 ORDER BY ordinal', [id])).linhas
        return { plano, resultados: resultados.slice(0, 50), recibo, execucao, lotes, pagina, temProxima: resultados.length > 50 }
      })
    },
    async vendedores() {
      return comoUsuario(usuarioId, async e => (await e<{ id: string; nome: string }>("SELECT id,nome FROM usuario u WHERE eh_gestor() AND (papel='vendedor' OR EXISTS(SELECT 1 FROM google_planejamento p WHERE p.vendedor_id=u.id)) ORDER BY nome,id")).linhas)
    },
    async agentes(): Promise<AgenteGoogle[]> {
      return comoUsuario(usuarioId,async e=>(await e<AgenteGoogle>(`SELECT a.vendedor_id,u.nome,a.pausado,
        (u.ativo AND u.papel='vendedor' AND NOT u.senha_provisoria_pendente) AS disponivel,
        ultimo.estado,ultimo.iniciado_em::text AS ultimo_inicio FROM google_agente a JOIN usuario u ON u.id=a.vendedor_id
        LEFT JOIN LATERAL (SELECT p.estado,p.iniciado_em FROM google_planejamento p WHERE p.vendedor_id=a.vendedor_id
          AND p.iniciado_em IS NOT NULL ORDER BY p.iniciado_em DESC,p.id LIMIT 1) ultimo ON true ORDER BY u.nome,u.id`)).linhas)
    },
    async definirAgente(id: string, pausado: boolean): Promise<{ok:true}|{ok:false;motivo:string}> {
      if (!UUID.test(id)) return {ok:false,motivo:'Vendedor inválido.'}
      try {
        await comoUsuario(usuarioId,e=>e('SELECT google_agente_definir($1,$2)',[id,pausado]))
        return {ok:true}
      } catch (erro) {
        if (['42501','22023'].includes((erro as {code:string}).code)) return {ok:false,motivo:'Seu acesso não permite alterar este agente.'}
        throw erro
      }
    },
    async podeSincronizar(id: string): Promise<boolean> {
      if (!UUID.test(id)) return false
      return comoUsuario(usuarioId,async e=>(await e<{id:string}>('SELECT id FROM google_planejamento WHERE id=$1',[id])).linhas.length===1)
    },
    async consultar(pedido: string, executor: string): Promise<ProgressoGoogle | null> {
      if (!UUID.test(pedido) || !UUID.test(executor)) return null
      return comoUsuario(usuarioId, async executar => (await executar<{ estado: ProgressoGoogle }>(`
        SELECT jsonb_build_object('pedido_id',e.pedido_id,'execucao_id',e.id,'executor_id',e.executor_id,'vendedor_id',e.vendedor_id,
          'contrato',e.contrato,'revisao',e.revisao,'snapshot_sha256',encode(sha256(convert_to(e.snapshot::text,'UTF8')),'hex'),
          'analisadas',e.analisadas,'entregues',e.entregues,'lotes',e.lotes_reservados,'concluido_em',e.concluido_em::text,'motivo_parada',e.motivo_parada,
          'vistas',(SELECT coalesce(jsonb_agg(DISTINCT k.identidade ORDER BY k.identidade),'[]') FROM google_lote l
            CROSS JOIN LATERAL jsonb_array_elements(l.candidatas) c
            CROSS JOIN LATERAL (VALUES(nullif(c.value->>'google_place_id','')),(CASE WHEN nullif(c.value->>'cnpj','') IS NOT NULL THEN 'cnpj:'||(c.value->>'cnpj') END)) k(identidade)
            WHERE l.execucao_id=e.id AND k.identidade IS NOT NULL),
          'lote_pendente',(SELECT jsonb_build_object('id',l.id,'ordinal',l.ordinal,'candidatas',l.candidatas) FROM google_lote l WHERE l.execucao_id=e.id AND l.concluido_em IS NULL),
          'lotes_confirmados',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'ordinal',l.ordinal,'resposta',l.resposta,
            'origem_sha256',l.recibo->>'origem_sha256','resultado_sha256',l.recibo->>'resultado_sha256') ORDER BY l.ordinal),'[]')
            FROM google_lote l WHERE l.execucao_id=e.id AND l.concluido_em IS NOT NULL)) AS estado
        FROM google_execucao e WHERE e.pedido_id=$1 AND e.executor_id=$2 AND e.gestor_id=usuario_atual() AND eh_gestor() AND pode_escrever()
      `, [pedido, executor])).linhas[0]?.estado ?? null)
    },
    async proximo(executor: string): Promise<{ pedido: Record<string, unknown> | null; agente?: string; ocupado?: boolean; sincronizar?: string }> {
      return comoUsuario(usuarioId, async e => (await e<{ r: { pedido: Record<string, unknown> | null; agente?: string; ocupado?: boolean; sincronizar?: string } }>('SELECT google_agente_proximo($1) AS r', [executor])).linhas[0].r)
    },
    async etapa(id: string, estado: string, motivo: string | null, executor: string) {
      await comoUsuario(usuarioId, e => e('SELECT google_agente_etapa($1,$2,$3,$4)', [id, estado, motivo, executor]))
    },
    async entregar(id: string, empresas: Record<string, unknown>[], recibo: Record<string, unknown>, executor: string) {
      return comoUsuario(usuarioId, async e => (await e<{ resultado: string }>('SELECT google_agente_entregar($1,$2,$3,$4) AS resultado',
        [id, JSON.stringify(empresas), JSON.stringify(recibo), executor])).linhas[0].resultado)
    },
  }
}
