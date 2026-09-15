import { comoUsuario } from '../../server/db/como-usuario'
import type { ResumoVendedor } from './consulta'

export const EMPRESAS_POR_PAGINA = 50
export type EmpresaDoVendedor = {
  id: string
  nome: string
  cnpj: string
  proximoPasso: string | null
  retorno: string | null
}
export type RegistroDoVendedor = {
  id: string
  empresaId: string
  empresa: string
  tipo: string
  nota: string | null
  proximoPasso: string | null
  retorno: string | null
  em: string
}
export type PerfilVendedor = ResumoVendedor & {
  email: string
  pagina: number
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
      ), carteira AS MATERIALIZED (
        SELECT e.id,e.razao_social AS nome,e.cnpj,ultimo.proximo_passo AS "proximoPasso",
          ultimo.proximo_passo_data AS retorno
        FROM empresa_fila f JOIN alvo a ON a.id=f.vendedor_id JOIN empresa e ON e.id=f.empresa_id
        LEFT JOIN LATERAL (
          SELECT proximo_passo,proximo_passo_data FROM contato WHERE empresa_id=e.id
          ORDER BY criado_em DESC,id DESC LIMIT 1
        ) ultimo ON true
      ), paginada AS (
        SELECT id,nome,cnpj,"proximoPasso",to_char(retorno,'YYYY-MM-DD') AS retorno
        FROM carteira ORDER BY nome,id LIMIT 50 OFFSET $2
      ), recentes AS (
        SELECT c.id,c.empresa_id AS "empresaId",e.razao_social AS empresa,c.tipo,c.nota,
          c.proximo_passo AS "proximoPasso",to_char(c.proximo_passo_data,'YYYY-MM-DD') AS retorno,c.criado_em AS em
        FROM contato c JOIN alvo a ON a.id=c.criado_por JOIN empresa e ON e.id=c.empresa_id
        ORDER BY c.criado_em DESC,c.id DESC LIMIT 20
      )
      SELECT jsonb_build_object('id',a.id,'nome',a.nome,'email',a.email,'pagina',$3::int,
        'clientes',(SELECT count(*)::int FROM carteira),
        'atrasados',(SELECT count(*)::int FROM carteira WHERE retorno<d.hoje),
        'hoje',(SELECT count(*)::int FROM carteira WHERE retorno=d.hoje),
        'contatosHoje',(SELECT count(*)::int FROM contato c WHERE c.criado_por=a.id AND c.tipo<>'nao_liguei'
          AND c.criado_em >= (d.hoje::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND c.criado_em < ((d.hoje+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')),
        'empresas',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.nome,p.id) FROM paginada p),'[]'::jsonb),
        'atividade',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.em DESC,r.id DESC) FROM recentes r),'[]'::jsonb)
      ) AS perfil FROM alvo a CROSS JOIN dia d
    `, [vendedorId, (atual - 1) * EMPRESAS_POR_PAGINA, atual])
    return linhas[0]?.perfil ?? null
  })
}
