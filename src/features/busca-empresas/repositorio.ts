import type { QueryResultRow } from 'pg'
import { comoUsuario } from '@/src/server/db/como-usuario'
import type { BuscaSalva, FiltrosBusca, LimiteBusca, ResultadoFornecedor } from './tipos'

export type FalhaBanco = 'sem_permissao' | 'operacao_invalida' | 'empresa_repetida'
export type ResumoBusca = Omit<BuscaSalva, 'empresas'> & { retornadas: number }
export type GrupoGoogle = { id: string; nome: string; criado_em: string; total: number }
export type RepositorioBusca = Pick<ReturnType<typeof repositorioBusca>, 'reservar' | 'concluir'>
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
function motivo(erro: unknown): FalhaBanco {
  const codigo = (erro as { code?: string }).code
  if (codigo === '42501') return 'sem_permissao'
  if (codigo === '23505') return 'empresa_repetida'
  if (codigo === '22023') return 'operacao_invalida'
  throw erro
}
const COLUNAS = `b.id,b.nome,b.fornecedor,b.usuario_id,u.nome AS vendedor,b.criado_em::text,b.filtros,b.estado,b.motivo,b.grupo_id`
const USADO = `(SELECT coalesce(sum(b.quantidade),0)::int FROM busca_empresa b WHERE b.usuario_id=u.id
  AND (b.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date)`
const LIMITES = `SELECT u.id AS usuario_id,u.nome AS vendedor,coalesce(l.limite_diario,0) AS limite_diario,
  coalesce(l.pausado,false) AS pausado,${USADO} AS usado FROM usuario u LEFT JOIN busca_empresa_limite l ON l.usuario_id=u.id`

export function repositorioBusca(usuarioId: string) {
  const executar = <T extends QueryResultRow,>(sql: string, params: unknown[] = []) => comoUsuario(usuarioId, e => e<T>(sql, params)).then(r => r.linhas)
  return {
    async reservar(chave: string, nome: string, filtros: FiltrosBusca): Promise<{ ok: true; repetida: boolean } | { ok: false; motivo: FalhaBanco | 'limite' | 'pausada' }> {
      try {
        const [r] = await executar<{ resultado: 'ok' | 'repetida' | 'limite' | 'pausada' }>(
          'SELECT busca_empresa_reservar_casa($1,$2,$3) AS resultado', [chave, nome, JSON.stringify(filtros)])
        if (r.resultado === 'ok' || r.resultado === 'repetida') return { ok: true, repetida: r.resultado === 'repetida' }
        return { ok: false, motivo: r.resultado }
      } catch (erro) { return { ok: false, motivo: motivo(erro) } }
    },
    async concluir(id: string, resultado: ResultadoFornecedor): Promise<void> {
      await executar('SELECT busca_empresa_concluir($1,$2,$3)',
        [id, JSON.stringify(resultado.ok ? resultado.empresas : []), resultado.ok ? null : resultado.motivo])
    },
    async ler(id: string): Promise<BuscaSalva | null> {
      if (!UUID.test(id)) return null
      return (await executar<BuscaSalva>(`SELECT ${COLUNAS},b.empresas FROM busca_empresa b JOIN usuario u ON u.id=b.usuario_id WHERE b.id=$1`, [id]))[0] ?? null
    },
    async listar(): Promise<ResumoBusca[]> {
      return executar<ResumoBusca>(`SELECT ${COLUNAS},jsonb_array_length(b.empresas)::int AS retornadas
        FROM busca_empresa b JOIN usuario u ON u.id=b.usuario_id ORDER BY b.criado_em DESC,b.id DESC LIMIT 50`)
    },
    async meuLimite(): Promise<LimiteBusca | null> {
      return (await executar<LimiteBusca>(LIMITES + ' WHERE u.id=usuario_atual()'))[0] ?? null
    },
    async listarLimites(): Promise<LimiteBusca[]> {
      return executar<LimiteBusca>(LIMITES + " WHERE eh_gestor() AND u.papel='vendedor' ORDER BY u.nome,u.id")
    },
    async definirLimite(id: string, limite: number, pausado: boolean): Promise<{ ok: true } | { ok: false; motivo: FalhaBanco }> {
      if (!UUID.test(id) || !Number.isInteger(limite) || limite < 0 || limite > 10000) return { ok: false, motivo: 'operacao_invalida' }
      try {
        await executar('SELECT busca_empresa_limite_definir($1,$2,$3)', [id, limite, pausado])
        return { ok: true }
      } catch (erro) { return { ok: false, motivo: motivo(erro) } }
    },
    async importar(id: string, cnpjs: string[]): Promise<{ ok: true; grupoId: string; inseridas: number; vinculadas: number } | { ok: false; motivo: FalhaBanco }> {
      if (!UUID.test(id) || cnpjs.length < 1 || cnpjs.length > 100 || cnpjs.some(c => !/^[0-9A-Z]{12}[0-9]{2}$/.test(c))) return { ok: false, motivo: 'operacao_invalida' }
      try {
        const [r] = await executar<{ grupo_id: string; inseridas: number; vinculadas: number }>('SELECT * FROM busca_empresa_importar($1,$2)', [id, cnpjs])
        return { ok: true, grupoId: r.grupo_id, inseridas: r.inseridas, vinculadas: r.vinculadas }
      } catch (erro) { return { ok: false, motivo: motivo(erro) } }
    },
    async gruposGoogle(): Promise<GrupoGoogle[]> {
      return executar<GrupoGoogle>('SELECT id,nome,criado_em::text,total FROM busca_empresa_grupos_google()')
    },
  }
}
