import type { Client } from 'pg'
import { comAdmin } from '../admin'
import { PAPEIS_APLICACAO } from './aplicar'

export type ResultadoInvariantes = { ok: true } | { ok: false; violacoes: string[] }

// Duas listas, duas perguntas diferentes sobre o mesmo conjunto.

// Pergunta 1: quais funções TÊM QUE EXISTIR. Ausência é violação, não verde.
export const FUNCOES_DE_ACESSO_OBRIGATORIAS = [
  'public.usuario_atual',
  'public.pode_ler',
  'public.eh_gestor',
  'public.pode_escrever',
  'public.senha_provisoria_de',
] as const

// Pergunta 2: quais podem TER GRANT para app_usuario. Fechada dos dois lados:
// definidora concedida fora daqui é violação, e nome daqui ausente ou sem
// GRANT também. As de acesso aparecem nas duas listas de propósito: são
// definidoras concedidas como qualquer outra, e "de acesso" é nome nosso, não
// do banco. Duas listas para a mesma classe de objeto sairiam de sincronia.
export const FUNCOES_CONCEDIDAS_A_APP_USUARIO = [
  'public.usuario_atual',
  'public.pode_ler',
  'public.eh_gestor',
  'public.pode_escrever',
  'public.senha_provisoria_de',
  'public.credencial_definir',
  'public.usuario_situacao_definir',
  'public.fila_puxar',
  'public.empresa_assumir',
] as const

// Pergunta 3: quais políticas podem liberar a tabela inteira. `USING (true)`
// não anula a RLS — declara que o dado é público para quem está autenticado.
// A regra 8 só garante que a RLS foi LIGADA: "RLS sem política" (nega tudo) e
// "RLS com USING (true)" (libera tudo) são idênticas para os dois booleanos de
// pg_class, e são opostas em efeito. Esta lista é a diferença.
//
// LIMITE HONESTO: pega só `true` literal em USING. `USING (1=1)` escapa, e
// WITH CHECK irrestrito (escrita) não é olhado. É catraca contra descuido e
// cópia, não contra quem quer burlar — mesma classe de limite da busca por
// prosrc. Está escrito para a lista não parecer mais forte do que é.
export const POLITICAS_DE_LEITURA_IRRESTRITA = ['public.cep.cep_leitura'] as readonly string[]

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
  politicasIrrestritas: string[]
  funcoesConcedidasAAppUsuario: string[]
  funcoesExecutaveisPorPublico: string[]
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
    `SELECT n.nspname || '.' || p.proname AS nome FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname || '.' || p.proname = ANY($1)`,
    [[...FUNCOES_DE_ACESSO_OBRIGATORIAS]],
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

  // pg_policies.qual é o texto do USING já normalizado pelo Postgres:
  // `USING (true)` volta como 'true'. Nome no formato schema.tabela.politica.
  const irrestritas = await c.query<{ nome: string }>(`
    SELECT schemaname || '.' || tablename || '.' || policyname AS nome
    FROM pg_policies
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      AND qual = 'true'
    ORDER BY 1`)

  // has_function_privilege lança se o papel não existe; sem app_usuario a
  // violação certa é "papel ausente", que já é avaliada.
  const temAppUsuario = papeis.rows.some((r) => r.nome === 'app_usuario')
  // Sem heurística de texto: toda definidora concedida, toque ou não
  // autenticacao. O critério antigo procurava 'autenticacao.' no corpo e
  // deixava de fora quem chega lá por outra função.
  const concedidas = temAppUsuario
    ? await c.query<{ nome: string }>(`
        SELECT n.nspname || '.' || p.proname AS nome
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE ${SCHEMAS_DO_SISTEMA} AND p.prosecdef
          AND has_function_privilege('app_usuario', p.oid, 'EXECUTE')
        ORDER BY 1`)
    : { rows: [] as { nome: string }[] }

  // proacl nulo é o padrão do Postgres: EXECUTE para PUBLIC. grantee = 0 é
  // a entrada explícita de PUBLIC no ACL.
  const publico = await c.query<{ nome: string }>(`
    SELECT n.nspname || '.' || p.proname AS nome
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE ${SCHEMAS_DO_SISTEMA}
      AND (p.proacl IS NULL OR EXISTS (
        SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))
    ORDER BY 1`)

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
    politicasIrrestritas: irrestritas.rows.map((r) => r.nome),
    funcoesConcedidasAAppUsuario: concedidas.rows.map((r) => r.nome),
    funcoesExecutaveisPorPublico: publico.rows.map((r) => r.nome),
  }
}

export function avaliar(e: Estado): string[] {
  const v: string[] = []

  for (const t of e.tabelas) {
    const nome = `${t.schema}.${t.nome}`
    if (!t.rls && t.nome !== '_migracao') v.push(`tabela sem RLS: ${nome}`)
    if (t.force) {
      v.push(
        `tabela com FORCE ROW LEVEL SECURITY: ${nome} (com dona comum, as funções de acesso ficam sujeitas a RLS sem política e negam tudo: bloqueio total)`,
      )
    }
  }

  for (const f of e.funcoesDefinidoras) {
    if (!f.temSearchPath) v.push(`${f.schema}.${f.nome} sem search_path vazio (SECURITY DEFINER exige)`)
  }

  for (const papel of PAPEIS_APLICACAO) {
    if (!e.papeis.includes(papel)) v.push(`papel ausente: ${papel}`)
  }
  for (const f of FUNCOES_DE_ACESSO_OBRIGATORIAS) {
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

  const registradas = new Set<string>(FUNCOES_CONCEDIDAS_A_APP_USUARIO)
  for (const nome of e.funcoesConcedidasAAppUsuario) {
    if (!registradas.has(nome)) v.push(`função definidora concedida a app_usuario e não registrada: ${nome}`)
  }
  const noBanco = new Set(e.funcoesConcedidasAAppUsuario)
  for (const nome of FUNCOES_CONCEDIDAS_A_APP_USUARIO) {
    if (!noBanco.has(nome)) v.push(`função registrada e ausente ou sem GRANT: ${nome}`)
  }

  const irrestritasRegistradas = new Set<string>(POLITICAS_DE_LEITURA_IRRESTRITA)
  for (const nome of e.politicasIrrestritas) {
    if (!irrestritasRegistradas.has(nome)) {
      v.push(`política de leitura irrestrita não registrada: ${nome} (USING (true) libera a tabela para todo app_usuario)`)
    }
  }
  const irrestritasNoBanco = new Set(e.politicasIrrestritas)
  for (const nome of POLITICAS_DE_LEITURA_IRRESTRITA) {
    if (!irrestritasNoBanco.has(nome)) v.push(`política de leitura irrestrita registrada e ausente: ${nome}`)
  }

  for (const nome of e.funcoesExecutaveisPorPublico) {
    v.push(`função de schema de aplicação executável por PUBLIC: ${nome} (função nova nasce assim; falta REVOKE)`)
  }

  return v
}

// Chamado pelo fim do db:aplicar e pelo teste de schema. Lista única de
// invariantes, para não haver duas listas mantidas à mão.
export async function conferirInvariantes(url: string): Promise<ResultadoInvariantes> {
  const violacoes = await comAdmin(url, async (c) => avaliar(await lerEstado(c)))
  return violacoes.length ? { ok: false, violacoes } : { ok: true }
}
