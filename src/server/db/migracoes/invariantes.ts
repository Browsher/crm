import type { Client } from 'pg'
import { comAdmin } from '../admin'
import { PAPEIS_APLICACAO } from './aplicar'

export type ResultadoInvariantes = { ok: true } | { ok: false; violacoes: string[] }

export const FUNCOES_DE_ACESSO = ['usuario_atual', 'pode_ler', 'eh_gestor', 'pode_escrever'] as const

// Retrato do catálogo que as invariantes olham. Separado da avaliação para
// que cada violação, inclusive ausência, tenha teste unitário sem banco.
export type Estado = {
  tabelas: { schema: string; nome: string; rls: boolean; force: boolean }[]
  funcoesDefinidoras: { schema: string; nome: string; temSearchPath: boolean }[]
  funcoesDeAcesso: string[]
  papeis: string[]
  conexao: { rolsuper: boolean; rolbypassrls: boolean; rolconnlimit: number; dona: number; herdaDe: string[] } | null
  migracaoAlcancavelPor: string[]
  privilegiosDeConexaoEmAutenticacao: string[]
  politicasEmAutenticacao: string[]
}

// Schemas de aplicação: tudo que não é do Postgres.
const SCHEMAS_DO_SISTEMA = "n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast') AND n.nspname NOT LIKE 'pg_temp%' AND n.nspname NOT LIKE 'pg_toast_temp%'"

export async function lerEstado(c: Client): Promise<Estado> {
  const tabelas = await c.query<Estado['tabelas'][number]>(`
    SELECT n.nspname AS schema, c.relname AS nome, c.relrowsecurity AS rls, c.relforcerowsecurity AS force
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND ${SCHEMAS_DO_SISTEMA}`)

  const definidoras = await c.query<{ schema: string; nome: string; proconfig: string[] | null }>(`
    SELECT n.nspname AS schema, p.proname AS nome, p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef AND ${SCHEMAS_DO_SISTEMA}`)

  const acesso = await c.query<{ nome: string }>(
    `SELECT p.proname AS nome FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = ANY($1)`,
    [[...FUNCOES_DE_ACESSO]],
  )

  const papeis = await c.query<{ nome: string }>('SELECT rolname AS nome FROM pg_roles WHERE rolname = ANY($1)', [
    [...PAPEIS_APLICACAO],
  ])

  const conexao = await c.query<NonNullable<Estado['conexao']>>(`
    SELECT r.rolsuper, r.rolbypassrls, r.rolconnlimit,
      (SELECT count(*)::int FROM pg_tables t WHERE t.tableowner = r.rolname) AS dona,
      COALESCE((SELECT array_agg(m.roleid::regrole::text) FROM pg_auth_members m
                WHERE m.member = r.oid AND m.inherit_option), '{}') AS "herdaDe"
    FROM pg_roles r WHERE r.rolname = 'app_conexao'`)

  const migracao = await c.query<{ nome: string }>(
    `SELECT rolname AS nome FROM pg_roles
     WHERE rolname = ANY($1) AND has_table_privilege(rolname, '_migracao', 'SELECT')`,
    [[...PAPEIS_APLICACAO]],
  )

  const privilegios = conexao.rows[0]
    ? await c.query<{ nome: string }>(`
        SELECT c.relname AS nome FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'autenticacao' AND c.relkind = 'r'
          AND (has_table_privilege('app_conexao', c.oid, 'SELECT') OR has_table_privilege('app_conexao', c.oid, 'INSERT')
            OR has_table_privilege('app_conexao', c.oid, 'UPDATE') OR has_table_privilege('app_conexao', c.oid, 'DELETE'))
        ORDER BY 1`)
    : { rows: [] as { nome: string }[] }
  const politicas = await c.query<{ nome: string }>(
    "SELECT policyname AS nome FROM pg_policies WHERE schemaname = 'autenticacao' ORDER BY 1",
  )

  return {
    tabelas: tabelas.rows,
    funcoesDefinidoras: definidoras.rows.map((f) => ({
      schema: f.schema,
      nome: f.nome,
      temSearchPath: f.proconfig?.some((cfg) => cfg.startsWith('search_path=')) ?? false,
    })),
    funcoesDeAcesso: acesso.rows.map((r) => r.nome),
    papeis: papeis.rows.map((r) => r.nome),
    conexao: conexao.rows[0] ?? null,
    migracaoAlcancavelPor: migracao.rows.map((r) => r.nome),
    privilegiosDeConexaoEmAutenticacao: privilegios.rows.map((r) => r.nome),
    politicasEmAutenticacao: politicas.rows.map((r) => r.nome),
  }
}

export function avaliar(e: Estado): string[] {
  const v: string[] = []

  for (const t of e.tabelas) {
    const nome = `${t.schema}.${t.nome}`
    if (!t.rls && t.nome !== '_migracao') v.push(`tabela sem RLS: ${nome}`)
    if (t.force) v.push(`tabela com FORCE ROW LEVEL SECURITY: ${nome} (recursão nas funções de acesso)`)
  }

  for (const f of e.funcoesDefinidoras) {
    if (!f.temSearchPath) v.push(`${f.schema}.${f.nome} sem search_path vazio (SECURITY DEFINER exige)`)
  }

  for (const papel of PAPEIS_APLICACAO) {
    if (!e.papeis.includes(papel)) v.push(`papel ausente: ${papel}`)
  }
  for (const f of FUNCOES_DE_ACESSO) {
    if (!e.funcoesDeAcesso.includes(f)) v.push(`função de acesso ausente: ${f}`)
  }

  if (e.conexao) {
    const c = e.conexao
    if (c.rolsuper) v.push('app_conexao é superusuário')
    if (c.rolbypassrls) v.push('app_conexao tem BYPASSRLS')
    if (c.dona > 0) v.push('app_conexao é dona de tabela')
    if (c.rolconnlimit <= 0) v.push('app_conexao sem CONNECTION LIMIT')
    for (const papel of c.herdaDe) v.push(`app_conexao herda privilégios de ${papel} (ver R-010)`)
  }

  for (const papel of e.migracaoAlcancavelPor) v.push(`_migracao alcançável por ${papel}`)

  for (const t of e.privilegiosDeConexaoEmAutenticacao) {
    v.push(`app_conexao alcança autenticacao.${t} direto; só função definidora pode tocar a tabela`)
  }
  for (const p of e.politicasEmAutenticacao) {
    v.push(`política em autenticacao: ${p} (tabela de autenticacao não tem política; alguém abriu para um papel)`)
  }

  return v
}

// Chamado pelo fim do db:aplicar e pelo teste de schema. Lista única de
// invariantes, para não haver duas listas mantidas à mão.
export async function conferirInvariantes(url: string): Promise<ResultadoInvariantes> {
  const violacoes = await comAdmin(url, async (c) => avaliar(await lerEstado(c)))
  return violacoes.length ? { ok: false, violacoes } : { ok: true }
}
