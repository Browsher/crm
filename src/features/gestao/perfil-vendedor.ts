import { comoUsuario } from '../../server/db/como-usuario'
import type { SituacaoEmpresa } from '../../lib/empresa-visual'
import type { ResumoVendedor } from './consulta'

export const EMPRESAS_POR_PAGINA = 50
export type EmpresaDoVendedor = {
  id: string
  nome: string
  cnpj: string | null
  situacao: SituacaoEmpresa
  proximoPasso: string | null
  retorno: string | null
}
export type RegistroDoVendedor = {
  id: string
  empresaId: string
  empresa: string
  tipo: string
  natureza: 'contato' | 'atividade_sem_ligacao'
  nota: string | null
  proximoPasso: string | null
  retorno: string | null
  em: string
}
export type PerfilVendedor = ResumoVendedor & {
  email: string
  pagina: number
  totalEmpresas: number
  empresas: EmpresaDoVendedor[]
  atividade: RegistroDoVendedor[]
}

export function paginaDoPerfil(valor: unknown): number {
  if (typeof valor !== 'string' && typeof valor !== 'number') return 1
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 1 && numero <= 1_000_000 ? numero : 1
}

export async function lerPerfilVendedor(gestorId: string, vendedorId: string, pagina = 1): Promise<PerfilVendedor | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendedorId)) return null
  const atual = paginaDoPerfil(pagina)
  return comoUsuario(gestorId, async executar => {
    const { linhas } = await executar<{ perfil: PerfilVendedor }>(`
      WITH alvo AS MATERIALIZED (
        SELECT id,nome,email FROM usuario WHERE id=$1 AND papel='vendedor' AND ativo AND eh_gestor()
      ), dia AS (
        SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje
      ), vinculos AS MATERIALIZED (
        SELECT v.* FROM empresa_vinculo v JOIN alvo a ON a.id=v.vendedor_id WHERE NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=v.empresa_id)
      ), numeradas AS (
        SELECT empresa_id,(row_number() OVER(ORDER BY empresa_id)-1)/100 AS lote FROM vinculos
      ), lotes AS (
        SELECT array_agg(empresa_id) AS ids FROM numeradas GROUP BY lote
      ), disponibilidade AS MATERIALIZED (
        SELECT item->>'empresaId' AS empresa_id,(item->>'disponivel')::boolean AS disponivel
        FROM lotes CROSS JOIN LATERAL jsonb_array_elements(empresas_disponibilidade_ler(ids)->'empresas') item
      ), carteira AS MATERIALIZED (
        SELECT e.id,coalesce(e.razao_social,e.nome_fantasia) AS nome,e.cnpj,c.proximo_passo AS "proximoPasso",
          c.proximo_passo_data AS retorno,
          f.vendedor_id=v.vendedor_id AND EXISTS(SELECT 1 FROM venda venda WHERE venda.empresa_id=e.id) AS cliente,
          n.id IS NOT NULL AS oportunidade,
          CASE WHEN NOT coalesce(d.disponivel,false) THEN 'indisponivel' WHEN v.arquivada_em IS NOT NULL THEN 'sem_interesse'
            WHEN f.vendedor_id=v.vendedor_id AND EXISTS(SELECT 1 FROM venda venda WHERE venda.empresa_id=e.id) THEN 'cliente'
            WHEN n.id IS NOT NULL THEN n.etapa::text WHEN v.iniciada_em IS NULL THEN 'a_contatar' ELSE 'atendimento' END AS situacao
        FROM vinculos v JOIN empresa e ON e.id=v.empresa_id
        LEFT JOIN disponibilidade d ON d.empresa_id=v.empresa_id::text
        LEFT JOIN empresa_fila f ON f.empresa_id=e.id
        LEFT JOIN contato c ON c.id=v.agenda_contato_id AND c.empresa_id=e.id AND v.arquivada_em IS NULL AND d.disponivel
        LEFT JOIN negociacao n ON n.empresa_id=e.id AND n.vendedor_id=v.vendedor_id AND n.encerrada_em IS NULL AND v.arquivada_em IS NULL
      ), paginada AS (
        SELECT id,nome,cnpj,situacao,"proximoPasso",to_char(retorno,'YYYY-MM-DD') AS retorno
        FROM carteira ORDER BY nome,id LIMIT 50 OFFSET $2
      ), recentes AS (
        SELECT c.id,c.empresa_id AS "empresaId",coalesce(e.razao_social,e.nome_fantasia) AS empresa,c.tipo,CASE WHEN c.tipo='nao_liguei' THEN 'atividade_sem_ligacao' ELSE 'contato' END AS natureza,c.nota,
          c.proximo_passo AS "proximoPasso",to_char(c.proximo_passo_data,'YYYY-MM-DD') AS retorno,c.criado_em AS em
        FROM contato c JOIN alvo a ON a.id=c.criado_por JOIN empresa e ON e.id=c.empresa_id
        WHERE NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=e.id)
        ORDER BY c.criado_em DESC,c.id DESC LIMIT 20
      )
      SELECT jsonb_build_object('id',a.id,'nome',a.nome,'email',a.email,'pagina',$3::int,
        'totalEmpresas',(SELECT count(*)::int FROM carteira),
        'clientes',(SELECT count(*)::int FROM carteira WHERE cliente),
        'oportunidades',(SELECT count(*)::int FROM carteira WHERE oportunidade),
        'atrasados',(SELECT count(*)::int FROM carteira WHERE retorno<d.hoje),
        'hoje',(SELECT count(*)::int FROM carteira WHERE retorno=d.hoje),
        'contatosHoje',(SELECT count(*)::int FROM contato c WHERE c.criado_por=a.id AND c.tipo<>'nao_liguei' AND NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=c.empresa_id)
          AND c.criado_em >= (d.hoje::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND c.criado_em < ((d.hoje+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')),
        'empresas',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.nome,p.id) FROM paginada p),'[]'::jsonb),
        'atividade',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.em DESC,r.id DESC) FROM recentes r),'[]'::jsonb)
      ) AS perfil FROM alvo a CROSS JOIN dia d
    `, [vendedorId, (atual - 1) * EMPRESAS_POR_PAGINA, atual])
    return linhas[0]?.perfil ?? null
  })
}
