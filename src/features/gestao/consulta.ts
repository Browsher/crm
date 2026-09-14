import { comoUsuario } from '../../server/db/como-usuario'

export type ResumoVendedor = {
  id: string
  nome: string
  clientes: number
  atrasados: number
  hoje: number
  contatosHoje: number
}
export type Atividade = { id: string; vendedor: string; empresa: string; tipo: string; em: string }
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
      ), carteira AS (
        SELECT f.vendedor_id, ultimo.proximo_passo_data AS retorno
        FROM empresa_fila f JOIN ativos a ON a.id=f.vendedor_id
        LEFT JOIN LATERAL (
          SELECT c.proximo_passo_data FROM contato c WHERE c.empresa_id=f.empresa_id
          ORDER BY c.criado_em DESC,c.id DESC LIMIT 1
        ) ultimo ON true
      ), resumos AS (
        SELECT a.id,a.nome,
          (SELECT count(*)::int FROM carteira f WHERE f.vendedor_id=a.id) AS clientes,
          (SELECT count(*)::int FROM carteira f WHERE f.vendedor_id=a.id AND f.retorno<d.hoje) AS atrasados,
          (SELECT count(*)::int FROM carteira f WHERE f.vendedor_id=a.id AND f.retorno=d.hoje) AS hoje,
          (SELECT count(*)::int FROM contato c WHERE c.criado_por=a.id AND c.tipo<>'nao_liguei'
            AND c.criado_em >= (d.hoje::timestamp AT TIME ZONE 'America/Sao_Paulo')
            AND c.criado_em < ((d.hoje+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')) AS "contatosHoje"
        FROM ativos a CROSS JOIN dia d
      ), recentes AS (
        SELECT c.id,a.nome AS vendedor,e.razao_social AS empresa,c.tipo,c.criado_em AS em
        FROM contato c JOIN ativos a ON a.id=c.criado_por JOIN empresa e ON e.id=c.empresa_id
        ORDER BY c.criado_em DESC,c.id DESC LIMIT 10
      )
      SELECT jsonb_build_object(
        'vendedores',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.nome,r.id) FROM resumos r),'[]'::jsonb),
        'atividade',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.em DESC,r.id DESC) FROM recentes r),'[]'::jsonb),
        'disponiveis',(SELECT count(*)::int FROM empresa e
          LEFT JOIN empresa_fila f ON f.empresa_id=e.id LEFT JOIN usuario dono ON dono.id=f.vendedor_id
          WHERE NOT coalesce(dono.ativo,false)
            AND (f.reservado_ate IS NULL OR f.reservado_ate<=now())
            AND (f.elegivel_em IS NULL OR f.elegivel_em<=now())
            AND EXISTS (SELECT 1 FROM grupo_importacao_empresa ge JOIN grupo_importacao g ON g.id=ge.grupo_id
              WHERE ge.empresa_id=e.id AND g.ativo))
      ) AS painel WHERE eh_gestor()
    `)
    return linhas[0]?.painel ?? null
  })
}
