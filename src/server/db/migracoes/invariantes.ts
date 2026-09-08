import { comAdmin } from '../admin'
import { PAPEIS_APLICACAO } from './aplicar'

export type ResultadoInvariantes = { ok: true } | { ok: false; violacoes: string[] }

// Chamado pelo fim do db:aplicar e pelo teste de schema. Lista única de
// invariantes, para não haver duas listas mantidas à mão.
export async function conferirInvariantes(url: string): Promise<ResultadoInvariantes> {
  return comAdmin(url, async (c) => {
    const v: string[] = []

    const semRls = await c.query<{ nome: string }>(`
      SELECT c.relname AS nome FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_migracao' AND NOT c.relrowsecurity`)
    for (const r of semRls.rows) v.push(`tabela sem RLS: ${r.nome}`)

    const comForce = await c.query<{ nome: string }>(`
      SELECT c.relname AS nome FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity`)
    for (const r of comForce.rows) {
      v.push(`tabela com FORCE ROW LEVEL SECURITY: ${r.nome} (recursão nas funções de acesso)`)
    }

    for (const papel of PAPEIS_APLICACAO) {
      const existe = await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [papel])
      if (existe.rowCount === 0) continue
      const alcanca = await c.query<{ le: boolean }>(
        "SELECT has_table_privilege($1, '_migracao', 'SELECT') AS le",
        [papel],
      )
      if (alcanca.rows[0].le) v.push(`_migracao alcançável por ${papel}`)
    }

    const conexao = await c.query<{ rolsuper: boolean; rolbypassrls: boolean; dona: number }>(`
      SELECT r.rolsuper, r.rolbypassrls,
        (SELECT count(*)::int FROM pg_tables t WHERE t.tableowner = r.rolname) AS dona
      FROM pg_roles r WHERE r.rolname = 'app_conexao'`)
    if (conexao.rows[0]) {
      const r = conexao.rows[0]
      if (r.rolsuper) v.push('app_conexao é superusuário')
      if (r.rolbypassrls) v.push('app_conexao tem BYPASSRLS')
      if (r.dona > 0) v.push('app_conexao é dona de tabela')
    }

    const funcoes = await c.query<{ nome: string; prosecdef: boolean; proconfig: string[] | null }>(`
      SELECT p.proname AS nome, p.prosecdef, p.proconfig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('usuario_atual', 'pode_ler', 'eh_gestor')`)
    for (const f of funcoes.rows) {
      if (!f.prosecdef) v.push(`${f.nome} sem SECURITY DEFINER`)
      if (!f.proconfig?.some((cfg) => cfg.startsWith('search_path='))) v.push(`${f.nome} sem search_path vazio`)
    }

    return v.length ? { ok: false, violacoes: v } : { ok: true }
  })
}
