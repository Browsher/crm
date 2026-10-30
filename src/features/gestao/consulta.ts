import { comoUsuario } from '../../server/db/como-usuario'

export type ResumoVendedor = {
  id: string
  nome: string
  clientes: number
  oportunidades: number
  atrasados: number
  hoje: number
  contatosHoje: number
}
export type Atividade = { id: string; vendedor: string; empresa: string; tipo: string; natureza: 'contato' | 'atividade_sem_ligacao'; em: string }
export type Dashboard = { vendedores: ResumoVendedor[]; disponiveis: number; atividade: Atividade[] }

// Uma instrução mantém estoque, equipe e atividade no mesmo snapshot.
// A autorização no SQL também protege chamadas que não passam pela página.
export async function lerDashboard(usuarioId: string): Promise<Dashboard | null> {
  return comoUsuario(usuarioId, async executar => {
    const { linhas } = await executar<{ painel: Dashboard }>(`
      WITH ativos AS MATERIALIZED (
        SELECT id,nome FROM usuario WHERE papel='vendedor' AND ativo AND eh_gestor()
      ), dia AS (
        SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje
      ), vinculos AS MATERIALIZED (
        SELECT v.* FROM empresa_vinculo v JOIN ativos a ON a.id=v.vendedor_id WHERE NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=v.empresa_id)
      ), numeradas AS (
        SELECT empresa_id,(row_number() OVER(ORDER BY empresa_id)-1)/100 AS lote FROM vinculos
      ), lotes AS (
        SELECT array_agg(empresa_id) AS ids FROM numeradas GROUP BY lote
      ), disponibilidade AS MATERIALIZED (
        SELECT item->>'empresaId' AS empresa_id,(item->>'disponivel')::boolean AS disponivel
        FROM lotes CROSS JOIN LATERAL jsonb_array_elements(empresas_disponibilidade_ler(ids)->'empresas') item
      ), carteira AS (
        SELECT v.vendedor_id, c.proximo_passo_data AS retorno,
          EXISTS(SELECT 1 FROM empresa_fila f WHERE f.empresa_id=v.empresa_id AND f.vendedor_id=v.vendedor_id)
            AND EXISTS(SELECT 1 FROM venda venda WHERE venda.empresa_id=v.empresa_id) AS cliente,
          v.arquivada_em IS NULL AND EXISTS(SELECT 1 FROM negociacao n WHERE n.empresa_id=v.empresa_id AND n.vendedor_id=v.vendedor_id AND n.encerrada_em IS NULL) AS oportunidade
        FROM vinculos v LEFT JOIN disponibilidade d ON d.empresa_id=v.empresa_id::text
        LEFT JOIN contato c ON c.id=v.agenda_contato_id AND c.empresa_id=v.empresa_id AND v.arquivada_em IS NULL AND d.disponivel
      ), resumos AS (
        SELECT a.id,a.nome,
          (SELECT count(*)::int FROM carteira f WHERE f.vendedor_id=a.id AND f.cliente) AS clientes,
          (SELECT count(*)::int FROM carteira f WHERE f.vendedor_id=a.id AND f.oportunidade) AS oportunidades,
          (SELECT count(*)::int FROM carteira f WHERE f.vendedor_id=a.id AND f.retorno<d.hoje) AS atrasados,
          (SELECT count(*)::int FROM carteira f WHERE f.vendedor_id=a.id AND f.retorno=d.hoje) AS hoje,
          (SELECT count(*)::int FROM contato c WHERE c.criado_por=a.id AND c.tipo<>'nao_liguei' AND NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=c.empresa_id)
            AND c.criado_em >= (d.hoje::timestamp AT TIME ZONE 'America/Sao_Paulo')
            AND c.criado_em < ((d.hoje+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')) AS "contatosHoje"
        FROM ativos a CROSS JOIN dia d
      ), recentes AS (
        SELECT c.id,a.nome AS vendedor,coalesce(e.razao_social,e.nome_fantasia) AS empresa,c.tipo,CASE WHEN c.tipo='nao_liguei' THEN 'atividade_sem_ligacao' ELSE 'contato' END AS natureza,c.criado_em AS em
        FROM contato c JOIN ativos a ON a.id=c.criado_por JOIN empresa e ON e.id=c.empresa_id
        WHERE NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=e.id)
        ORDER BY c.criado_em DESC,c.id DESC LIMIT 10
      )
      SELECT jsonb_build_object(
        'vendedores',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.nome,r.id) FROM resumos r),'[]'::jsonb),
        'atividade',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.em DESC,r.id DESC) FROM recentes r),'[]'::jsonb),
        'disponiveis',(SELECT count(*)::int FROM empresa e
          WHERE NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=e.id) AND NOT EXISTS(SELECT 1 FROM empresa_vinculo v WHERE v.empresa_id=e.id)
            AND NOT EXISTS(SELECT 1 FROM empresa_vinculo_pendencia p WHERE p.empresa_id=e.id)
            AND NOT EXISTS (SELECT 1 FROM venda v WHERE v.empresa_id=e.id)
            AND EXISTS (SELECT 1 FROM grupo_importacao_empresa ge JOIN grupo_importacao g ON g.id=ge.grupo_id
              WHERE ge.empresa_id=e.id AND g.ativo))
      ) AS painel WHERE eh_gestor()
    `)
    return linhas[0]?.painel ?? null
  })
}
