import { validarMetadadosGrupo, type MetadadosGrupo } from '../../lib/grupo-metadados'
import { comoUsuario, type Executar } from '../../server/db/como-usuario'

export type ResumoGrupo = {
  id: string; nome: string; arquivoNome: string | null; ativo: boolean
  criadoEm: string; autor: string | null; total: number; arquivada: boolean
  descricao: string | null; origem: string | null; criterios: string | null
}
export type ContagensGrupo = { total: number; disponiveis: number; carteiras: number; reservadas: number; outros: number }
export type ResumoGrupos = { total: number; ativos: number; desativados: number; empresas: number }
export type EmpresaGrupo = {
  id: string; cnpj: string | null; razaoSocial: string | null; nomeFantasia: string | null
  situacao: 'disponivel' | 'carteira' | 'reservada' | 'em_descanso' | 'origem_bloqueada' | 'arquivada'
  responsavel: string | null; responsavelAtivo: boolean | null
  reservadoPor: string | null; reservadoAte: string | null; elegivelEm: string | null
  outrosGrupos: { id: string; nome: string; ativo: boolean }[]
}
type Falha = { ok: false; motivo: 'sem_permissao' | 'nao_encontrado' | 'nome_invalido' }
export type ResultadoGrupos = { ok: true; grupos: ResumoGrupo[]; resumo: ResumoGrupos } | Falha
export type ResultadoGrupo = {
  ok: true; grupo: ResumoGrupo; empresas: EmpresaGrupo[]; contagens: ContagensGrupo; impactoDesativacao: number
} | Falha

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function paginaGrupos(valor: unknown): number {
  const n = typeof valor === 'string' || typeof valor === 'number' ? Number(valor) : NaN
  return Number.isSafeInteger(n) && n > 0 && n <= 1_000_000 ? n : 1
}

// Uma fotografia por statement: resumo global independente de LIMIT/OFFSET.
const GRUPOS = `SELECT g.id, g.nome, g.arquivo_nome AS "arquivoNome", g.ativo, g.descricao, g.origem, g.criterios,
  EXISTS(SELECT 1 FROM public.grupo_importacao_arquivo WHERE grupo_id=g.id) AS arquivada,
  g.criado_em::text AS "criadoEm", u.nome AS autor,
  (SELECT count(*)::integer FROM public.grupo_importacao_empresa ge WHERE ge.grupo_id = g.id) AS total
  FROM public.grupo_importacao g LEFT JOIN public.usuario u ON u.id = g.criado_por`

async function ler<T>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>): Promise<T | Falha> {
  try {
    return await comoUsuario(usuarioId, async executar => {
      const { linhas } = await executar<{ gestor: boolean }>('SELECT public.eh_gestor() AS gestor')
      if (!linhas[0]?.gestor) return { ok: false, motivo: 'sem_permissao' } as const
      return trabalho(executar)
    })
  } catch (erro) {
    if ((erro as { code?: string })?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}

export async function listarGrupos(usuarioId: string, pagina = 1, arquivadas = false): Promise<ResultadoGrupos> {
  return ler(usuarioId, async executar => {
    const { linhas } = await executar<{ grupos: ResumoGrupo[]; resumo: ResumoGrupos }>(`
      WITH grupos AS (${GRUPOS} WHERE EXISTS(SELECT 1 FROM public.grupo_importacao_arquivo WHERE grupo_id=g.id)=$2::boolean), pagina AS (
        SELECT * FROM grupos ORDER BY "criadoEm" DESC, id LIMIT 50 OFFSET $1
      ) SELECT coalesce((SELECT jsonb_agg(p ORDER BY p."criadoEm" DESC,p.id) FROM pagina p),'[]') AS grupos,
      jsonb_build_object('total',(SELECT count(*) FROM grupos),
        'ativos',(SELECT count(*) FROM grupos WHERE ativo),
        'desativados',(SELECT count(*) FROM grupos WHERE NOT ativo),
        'empresas',(SELECT count(DISTINCT ge.empresa_id) FROM public.grupo_importacao_empresa ge JOIN grupos g ON g.id=ge.grupo_id)) AS resumo`,
    [(paginaGrupos(pagina) - 1) * 50, arquivadas])
    return { ok: true as const, ...linhas[0] }
  })
}

export async function detalharGrupo(usuarioId: string, id: string, pagina = 1): Promise<ResultadoGrupo> {
  if (!UUID.test(id)) return { ok: false, motivo: 'nao_encontrado' }
  return ler(usuarioId, async executar => {
    // Classificação administrativa do histórico de posse/reserva/descanso.
    // Estes indicadores não autorizam aquisição nem acesso comercial ao grupo.
    const { linhas } = await executar<Omit<Extract<ResultadoGrupo, { ok: true }>, 'ok'>>(`
      WITH grupo AS (${GRUPOS} WHERE g.id = $1), membros AS (
        SELECT e.id,e.cnpj,e.razao_social AS "razaoSocial",e.nome_fantasia AS "nomeFantasia",dono.nome AS responsavel,
          dono.ativo AS "responsavelAtivo",reserva.nome AS "reservadoPor",
          f.reservado_ate::text AS "reservadoAte",f.elegivel_em::text AS "elegivelEm",
          coalesce(origens.outros,'[]') AS "outrosGrupos",
          CASE WHEN EXISTS(SELECT 1 FROM public.empresa_arquivo WHERE empresa_id=e.id) THEN 'arquivada'
            WHEN f.vendedor_id IS NOT NULL AND dono.ativo THEN 'carteira'
            WHEN f.reservado_ate > now() THEN 'reservada'
            WHEN f.elegivel_em > now() THEN 'em_descanso'
            WHEN origens.ativa THEN 'disponivel' ELSE 'origem_bloqueada' END AS situacao,
          coalesce(origens.outra_ativa,false) AS outra_ativa
        FROM public.grupo_importacao_empresa ge
        JOIN public.empresa e ON e.id = ge.empresa_id
        LEFT JOIN public.empresa_fila f ON f.empresa_id = e.id
        LEFT JOIN public.usuario dono ON dono.id = f.vendedor_id
        LEFT JOIN public.usuario reserva ON reserva.id = f.reservado_por
        LEFT JOIN LATERAL (
          SELECT bool_or(g.ativo) AS ativa, bool_or(g.ativo AND g.id <> $1) AS outra_ativa,
            jsonb_agg(jsonb_build_object('id',g.id,'nome',g.nome,'ativo',g.ativo) ORDER BY g.nome,g.id)
              FILTER (WHERE g.id <> $1) AS outros
          FROM public.grupo_importacao_empresa vinculo
          JOIN public.grupo_importacao g ON g.id = vinculo.grupo_id WHERE vinculo.empresa_id = e.id
        ) origens ON true WHERE ge.grupo_id = $1
      ), pagina AS (SELECT * FROM membros ORDER BY coalesce("razaoSocial","nomeFantasia"),id LIMIT 50 OFFSET $2)
      SELECT (SELECT to_jsonb(g) FROM grupo g) AS grupo,
        coalesce((SELECT jsonb_agg(to_jsonb(p) - 'outra_ativa' ORDER BY coalesce(p."razaoSocial",p."nomeFantasia"),p.id) FROM pagina p),'[]') AS empresas,
        jsonb_build_object('total',count(*),'disponiveis',count(*) FILTER (WHERE situacao = 'disponivel'),
          'carteiras',count(*) FILTER (WHERE situacao = 'carteira'),'reservadas',count(*) FILTER (WHERE situacao = 'reservada'),
          'outros',count(*) FILTER (WHERE situacao IN ('em_descanso','origem_bloqueada','arquivada'))) AS contagens,
        (count(*) FILTER (WHERE situacao = 'disponivel' AND NOT outra_ativa))::integer AS "impactoDesativacao"
      FROM membros`, [id, (paginaGrupos(pagina) - 1) * 50])
    if (!linhas[0]?.grupo) return { ok: false, motivo: 'nao_encontrado' } as const
    return { ok: true as const, ...linhas[0] }
  })
}

async function alterar(usuarioId: string, id: string, sql: string, valor: string | boolean): Promise<{ ok: true } | Falha> {
  if (!UUID.test(id)) return { ok: false, motivo: 'nao_encontrado' }
  try {
    return await comoUsuario(usuarioId, async executar => {
      const { linhas } = await executar<{ resultado: 'ok' | 'nao_encontrado' }>(sql, [id, valor])
      return linhas[0].resultado === 'ok' ? { ok: true } : { ok: false, motivo: 'nao_encontrado' }
    })
  } catch (erro) {
    const codigo = (erro as { code?: string })?.code
    if (codigo === '42501') return { ok: false, motivo: 'sem_permissao' }
    if (codigo === '22023') return { ok: false, motivo: 'nome_invalido' }
    throw erro
  }
}

export async function renomearGrupo(usuarioId: string, id: string, nome: string) {
  const limpo = nome.trim()
  if (!limpo || Array.from(limpo).length > 100 || /[\u0000-\u001f\u007f-\u009f]/u.test(nome)) {
    return { ok: false, motivo: 'nome_invalido' } as const
  }
  return alterar(usuarioId, id, 'SELECT public.grupo_importacao_renomear($1,$2) AS resultado', limpo)
}

export async function definirSituacaoGrupo(usuarioId: string, id: string, ativo: boolean) {
  return alterar(usuarioId, id, 'SELECT public.grupo_importacao_situacao_definir($1,$2) AS resultado', ativo)
}

export async function atualizarMetadadosGrupo(usuarioId: string, id: string, metadados: MetadadosGrupo): Promise<{ ok: true } | { ok: false; motivo: 'sem_permissao' | 'nao_encontrado' | 'metadados_invalidos' }> {
  if (!UUID.test(id)) return { ok: false, motivo: 'nao_encontrado' }
  const validado = validarMetadadosGrupo(metadados)
  if (!validado.ok) return { ok: false, motivo: 'metadados_invalidos' }
  try {
    return await comoUsuario(usuarioId, async executar => {
      const { descricao, origem, criterios } = validado.metadados
      const { linhas } = await executar<{ resultado: 'ok' | 'nao_encontrado' }>(
        'SELECT public.grupo_importacao_metadados_definir($1,$2,$3,$4) AS resultado', [id, descricao, origem, criterios],
      )
      return linhas[0].resultado === 'ok' ? { ok: true } : { ok: false, motivo: 'nao_encontrado' }
    })
  } catch (erro) {
    const codigo = (erro as { code?: string })?.code
    if (codigo === '42501') return { ok: false, motivo: 'sem_permissao' }
    if (codigo === '22023') return { ok: false, motivo: 'metadados_invalidos' }
    throw erro
  }
}
