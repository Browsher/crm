import { filtrosAtividade, PAGINA_ATIVIDADE, type FiltrosAtividade, type PaginaAtividade } from '../../lib/atividade-gestao'
import { comoUsuario } from '../../server/db/como-usuario'

export async function lerAtividadeGestao(
  gestorId: string,
  filtros: FiltrosAtividade,
  modo: 'historico' | 'destaques' | 'alerta' = 'historico',
): Promise<PaginaAtividade | null> {
  if (!filtrosAtividade(filtros)) return null
  const limite = modo === 'alerta' ? 1 : modo === 'destaques' ? 10 : PAGINA_ATIVIDADE
  const deslocamento = modo === 'historico' ? (filtros.pagina - 1) * PAGINA_ATIVIDADE : 0

  return comoUsuario(gestorId, async executar => {
    const { linhas } = await executar<{ pagina: PaginaAtividade }>(`
      WITH vendedores AS MATERIALIZED (
        SELECT id,nome FROM usuario
        WHERE eh_gestor() AND papel='vendedor' AND ativo AND ($1::uuid IS NULL OR id=$1)
      ), dia AS (
        SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje
      ), periodo AS (
        SELECT (hoje - CASE $2::text WHEN 'hoje' THEN 0 WHEN 'ontem' THEN 1 ELSE 6 END)::timestamp
            AT TIME ZONE 'America/Sao_Paulo' AS inicio,
          (hoje + CASE $2 WHEN 'ontem' THEN 0 ELSE 1 END)::timestamp
            AT TIME ZONE 'America/Sao_Paulo' AS fim
        FROM dia
      ), comerciais AS (
        SELECT v.id,v.autor_id AS vendedor_id,'venda'::text AS categoria,v.criada_em AS em,v.empresa_id,
          CASE WHEN v.negociacao_id IS NOT NULL OR NOT EXISTS (
            SELECT 1 FROM venda anterior WHERE anterior.empresa_id=v.empresa_id
              AND (anterior.criada_em,anterior.id)<(v.criada_em,v.id)
          ) THEN 'primeira_venda' ELSE 'recompra' END AS subtipo,
          jsonb_build_object('dataVenda',to_char(v.data,'YYYY-MM-DD'),
            'valorCentavos',v.valor_centavos::text,'nota',v.observacao) AS dados,
          true AS destaque
        FROM venda v JOIN vendedores a ON a.id=v.autor_id CROSS JOIN periodo p
        WHERE $3::text IN ('todos','venda') AND v.criada_em>=p.inicio AND v.criada_em<p.fim
        UNION ALL
        SELECT c.id,c.criado_por,CASE WHEN c.tipo='sem_interesse' THEN 'funil' ELSE 'contato' END,
          c.criado_em,c.empresa_id,c.tipo,
          jsonb_build_object('nota',c.nota,'proximoPasso',c.proximo_passo,'retorno',to_char(c.proximo_passo_data,'YYYY-MM-DD')),
          c.tipo NOT IN ('acompanhamento','nao_liguei','nao_atendeu')
        FROM contato c JOIN vendedores a ON a.id=c.criado_por CROSS JOIN periodo p
        WHERE $3 IN ('todos','contato','funil') AND c.criado_em>=p.inicio AND c.criado_em<p.fim
        UNION ALL
        SELECT o.id,o.usuario_id,'funil',o.criado_em,o.empresa_id,o.operacao,'{}'::jsonb,true
        FROM empresa_atendimento_operacao o JOIN vendedores a ON a.id=o.usuario_id CROSS JOIN periodo p
        WHERE $3 IN ('todos','funil') AND o.criado_em>=p.inicio AND o.criado_em<p.fim
          AND o.operacao IN ('arquivar','retomar','devolver_funil') AND o.resultado @> '{"ok":true}'::jsonb
      ), buscas_banco AS MATERIALIZED (
        SELECT b.* FROM busca_empresa b JOIN vendedores a ON a.id=b.usuario_id CROSS JOIN periodo p
        WHERE (($3 IN ('todos','banco') AND b.estado='concluida') OR ($3 IN ('todos','banco','falha') AND b.estado='falhou'))
          AND (b.concluido_em>=p.inicio AND b.concluido_em<p.fim OR b.estado='concluida' AND EXISTS (
            SELECT 1 FROM grupo_importacao_empresa ge JOIN empresa_vinculo v ON v.empresa_id=ge.empresa_id
            WHERE ge.grupo_id=b.grupo_id AND v.vendedor_id=b.usuario_id AND v.origem_inicial='banco'
              AND v.recebida_em>=p.inicio AND v.recebida_em<p.fim
          ))
      ), banco AS (
        SELECT b.id,b.usuario_id,'banco'::text AS categoria,
          coalesce(CASE WHEN entrega.total>0 THEN m.ultima END,b.concluido_em) AS em,
          NULL::uuid AS empresa_id,NULL::text AS empresa,b.estado AS subtipo,
          jsonb_build_object('nome',b.nome,'regiao',concat_ws(', ',nullif(b.filtros->>'bairro',''),
              nullif(b.filtros->>'cidade',''),nullif(b.filtros->>'uf','')),
            'situacao',b.estado,'solicitadas',b.quantidade,'retornadas',jsonb_array_length(b.empresas),
            'entregues',entrega.total,'motivo',b.motivo) AS dados,
          coalesce(entrega.total>0,false) AS destaque
        FROM buscas_banco b
        LEFT JOIN grupo_importacao g ON g.id=b.grupo_id
        LEFT JOIN LATERAL (
          -- A resposta pode ter empresas que nunca foram selecionadas. Cada membro
          -- do grupo precisa ter vínculo do vendedor e constar da resposta.
          SELECT count(*)::int AS membros,count(v.recebida_em)::int AS confirmadas,max(v.recebida_em) AS ultima
          FROM grupo_importacao_empresa ge JOIN empresa e ON e.id=ge.empresa_id
          LEFT JOIN empresa_vinculo v ON v.empresa_id=e.id AND v.vendedor_id=b.usuario_id
            AND v.origem_inicial='banco' AND v.recebida_em>=b.criado_em
            -- Dentro da mesma transação, grupo e vínculo usam now() e a
            -- conclusão da busca usa clock_timestamp().
            AND (v.recebida_em>=coalesce(b.concluido_em,b.criado_em) OR v.recebida_em=g.criado_em)
            AND b.empresas @> jsonb_build_array(jsonb_build_object('cnpj',e.cnpj))
            AND NOT EXISTS (
              -- Um vínculo antigo não pode provar a mesma entrega em outro grupo.
              SELECT 1 FROM grupo_importacao_empresa ge2
              JOIN busca_empresa outra ON outra.grupo_id=ge2.grupo_id
              JOIN grupo_importacao g2 ON g2.id=ge2.grupo_id
              WHERE ge2.empresa_id=e.id AND ge2.grupo_id<>b.grupo_id AND outra.usuario_id=b.usuario_id
                AND outra.estado='concluida' AND outra.criado_em<=v.recebida_em
                AND (coalesce(outra.concluido_em,outra.criado_em)<=v.recebida_em OR g2.criado_em=v.recebida_em)
                AND outra.empresas @> jsonb_build_array(jsonb_build_object('cnpj',e.cnpj))
            )
          WHERE ge.grupo_id=b.grupo_id AND b.estado='concluida'
        ) m ON true
        CROSS JOIN LATERAL (
          SELECT CASE WHEN b.estado='concluida' THEN
            CASE
              WHEN g.id IS NULL AND (b.inclusao_automatica_concluida OR jsonb_array_length(b.empresas)=0) THEN 0
              WHEN m.membros>0 AND m.membros=g.vinculadas AND m.membros=m.confirmadas AND NOT EXISTS (
                SELECT 1 FROM busca_empresa outra WHERE outra.grupo_id=g.id AND outra.id<>b.id
              ) THEN m.confirmadas
            END
          END AS total
        ) entrega
      ), pedidos_google AS MATERIALIZED (
        SELECT g.*,s.atualizada_em AS falha_atualizada_em
        FROM google_planejamento g JOIN vendedores a ON a.id=g.vendedor_id
        LEFT JOIN google_sincronizacao s ON s.pedido_id=g.id AND g.estado='falhou' AND s.versao>1
        CROSS JOIN periodo p
        WHERE ($3 IN ('todos','google') OR $3='falha' AND g.estado='falhou')
          -- Pedidos encerrados antes do período já tiveram suas últimas entregas.
          AND (g.concluido_em>=p.inicio OR g.concluido_em IS NULL AND (
            g.estado='falhou' AND coalesce(s.atualizada_em,g.iniciado_em,g.criado_em)>=p.inicio OR EXISTS (
              SELECT 1 FROM google_resultado r WHERE r.planejamento_id=g.id AND r.situacao='entregue'
                AND r.empresa_id IS NOT NULL AND r.entregue_em>=p.inicio AND r.entregue_em<p.fim
            )
          ))
      ), google AS (
        SELECT g.id,g.vendedor_id,'google'::text AS categoria,
          CASE WHEN g.estado='falhou' THEN coalesce(g.concluido_em,g.falha_atualizada_em,r.ultima,g.iniciado_em,g.criado_em)
            ELSE coalesce(r.ultima,g.concluido_em) END AS em,
          NULL::uuid AS empresa_id,NULL::text AS empresa,g.estado AS subtipo,
          jsonb_build_object('nome',g.nicho,'regiao',concat_ws(', ',nullif(g.bairro,''),nullif(g.cidade,''),nullif(g.uf,'')),
            'situacao',g.estado,'retornadas',r.registradas,'entregues',r.entregues,'motivo',g.motivo) AS dados,
          r.entregues>0 AS destaque
        FROM pedidos_google g
        CROSS JOIN LATERAL (
          SELECT count(*)::int AS registradas,
            (count(DISTINCT r.empresa_id) FILTER (WHERE r.situacao='entregue' AND r.entregue_em IS NOT NULL))::int AS entregues,
            max(r.entregue_em) FILTER (WHERE r.situacao='entregue' AND r.empresa_id IS NOT NULL) AS ultima
          FROM google_resultado r WHERE r.planejamento_id=g.id
        ) r
        WHERE r.entregues>0 OR g.estado IN ('concluido','falhou')
      ), eventos AS (
        SELECT c.id,c.vendedor_id,c.categoria,c.em,c.empresa_id,coalesce(e.razao_social,e.nome_fantasia) AS empresa,
          c.subtipo,c.dados,c.destaque
        FROM comerciais c JOIN empresa e ON e.id=c.empresa_id
        WHERE NOT EXISTS (SELECT 1 FROM empresa_arquivo ar WHERE ar.empresa_id=c.empresa_id)
        UNION ALL SELECT * FROM banco
        UNION ALL SELECT * FROM google
      ), filtrados AS MATERIALIZED (
        SELECT e.id,e.vendedor_id AS "vendedorId",a.nome AS vendedor,e.categoria,e.em,
          e.empresa_id AS "empresaId",e.empresa,e.subtipo,e.dados
        FROM eventos e JOIN vendedores a ON a.id=e.vendedor_id CROSS JOIN periodo p
        WHERE e.em>=p.inicio AND e.em<p.fim
          AND ($3 IN ('todos','falha') OR e.categoria=$3)
          AND ($4::text='historico'
            OR ($4='destaques' AND (e.destaque AND e.subtipo<>'falhou' OR $1 IS NOT NULL AND e.subtipo='falhou'))
            OR ($4='alerta' AND e.subtipo='falhou'))
      ), pagina AS (
        SELECT * FROM filtrados ORDER BY em DESC,id DESC,categoria,subtipo LIMIT $5 OFFSET $6
      )
      SELECT jsonb_build_object(
        'eventos',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.em DESC,p.id DESC,p.categoria,p.subtipo) FROM pagina p),'[]'::jsonb),
        'total',(SELECT count(*)::int FROM filtrados),'referencia',now()
      ) AS pagina
      WHERE eh_gestor()
    `, [filtros.vendedorId, filtros.periodo, modo === 'alerta' ? 'falha' : filtros.tipo, modo, limite, deslocamento])
    return linhas[0]?.pagina ?? null
  })
}
