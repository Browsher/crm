import { resumoEmpresa, type ResumoEmpresa } from '../../lib/empresa-visual'
import { lerDetalhesEmpresa } from '../empresas/detalhes'
import { comoUsuario } from '../db/como-usuario'
import type { EmpresaComigo } from '../../lib/agenda-atendimento'
import { resolverCeps } from '../cep/resolver'

export async function lerResumosBusca(usuarioId: string, buscaId: string) {
  const ids = await comoUsuario(usuarioId, async sql => (await sql<{ id: string }>(`SELECT DISTINCT e.id FROM busca_empresa b
    CROSS JOIN LATERAL jsonb_array_elements(b.empresas) item
    JOIN empresa e ON e.cnpj=item->>'cnpj'
    JOIN empresa_vinculo v ON v.empresa_id=e.id AND v.vendedor_id=usuario_atual()
    WHERE b.id=$1 AND b.usuario_id=usuario_atual()`, [buscaId])).linhas.map(e => e.id))
  return lerResumosEmpresas(usuarioId, ids)
}

export async function lerResumosEmpresas(usuarioId: string, empresaIds: readonly string[]): Promise<{ ok: true; empresas: ResumoEmpresa[] } | { ok: false; motivo: 'sem_permissao' | 'dados_invalidos' }> {
  const ids = [...new Set(empresaIds)]
  if (ids.length > 100 || ids.some(id => !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) return { ok: false, motivo: 'dados_invalidos' }
  try {
    return await comoUsuario(usuarioId, async sql => (await sql<{ resultado: { ok: true; empresas: ResumoEmpresa[] } | { ok: false; motivo: 'sem_permissao' | 'dados_invalidos' } }>('SELECT empresas_resumos_ler($1::uuid[]) AS resultado', [ids])).linhas[0].resultado)
  } catch (erro) {
    if ((erro as { code?: string }).code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}

export async function lerAtendimento(usuarioId: string, empresaId: string): Promise<{ ok: true; empresa: ResumoEmpresa; fase: 'inicial' | 'negociacao' | 'cliente' } | { ok: false; motivo: 'sem_permissao' | 'nao_encontrada' }> {
  const r = await lerDetalhesEmpresa(usuarioId, { tipo: 'cadastro', empresaId })
  if (!r.ok) return r
  const empresa = resumoEmpresa(r.dados)
  const fase = empresa.situacao === 'cliente' ? 'cliente' : ['primeiro_contato', 'em_negociacao', 'proposta_enviada'].includes(empresa.situacao) ? 'negociacao' : 'inicial'
  return { ok: true, empresa, fase }
}

// A tarefa vigente vem exclusivamente do vínculo. O lateral só fornece histórico.
// Resumos em lotes de até 100 no mesmo snapshot evitam misturar agenda antiga com arquivo recente.
export async function lerEmpresasAtendimento(usuarioId: string, somenteClientes = false, somenteDevidas = false): Promise<{ ok: true; linhas: EmpresaComigo[] } | { ok: false; motivo: 'sem_permissao' }> {
  try {
    return await comoUsuario(usuarioId, async sql => {
      type Linha = {
        id: string; cnpj: string | null; razao_social: string | null; nome_fantasia: string | null
        cnae_principal: string | null; contato_nome: string | null; telefone: string | null; email: string | null; cep: string | null
        ultimo_id: string | null; nota: string | null; criado_em: Date | null; proximo_passo: string | null; data: string | null
        situacao_retorno: EmpresaComigo['situacaoRetorno']; situacao: EmpresaComigo['situacao']; vencido: boolean; versao: number; empresa: ResumoEmpresa | null
      }
      const { linhas } = await sql<Linha>(`WITH selecionadas AS MATERIALIZED (SELECT e.id,e.cnpj,e.razao_social,e.nome_fantasia,e.cnae_principal,e.contato_nome,e.telefone,e.email,e.cep,
        CASE WHEN v.arquivada_em IS NOT NULL THEN 'sem_interesse'
          WHEN EXISTS(SELECT 1 FROM minhas_empresas_clientes() clientes WHERE clientes.empresa_id=e.id) THEN 'cliente'
          WHEN v.iniciada_em IS NULL THEN 'a_contatar' ELSE 'atendimento' END AS situacao,
        ultimo.id AS ultimo_id,ultimo.nota,ultimo.criado_em,agenda.proximo_passo,to_char(agenda.proximo_passo_data,'YYYY-MM-DD') AS data,v.versao,
        CASE WHEN agenda.proximo_passo_data IS NULL THEN 'sem_data'
          WHEN agenda.proximo_passo_data<(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'atrasado'
          WHEN agenda.proximo_passo_data=(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'hoje' ELSE 'futuro' END AS situacao_retorno,
        coalesce(agenda.proximo_passo_data<(now() AT TIME ZONE 'America/Sao_Paulo')::date,false) AS vencido
        FROM empresa_vinculo v JOIN empresa e ON e.id=v.empresa_id
        LEFT JOIN contato agenda ON agenda.id=v.agenda_contato_id AND agenda.empresa_id=v.empresa_id AND v.arquivada_em IS NULL
        LEFT JOIN LATERAL (SELECT c.id,c.nota,c.criado_em FROM contato c WHERE c.empresa_id=e.id ORDER BY c.criado_em DESC,c.id DESC LIMIT 1) ultimo ON true
        WHERE v.vendedor_id=$1 AND pode_ler() AND NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=e.id)
          AND (NOT $2::boolean OR EXISTS(SELECT 1 FROM minhas_empresas_clientes() clientes WHERE clientes.empresa_id=e.id))
          AND (NOT $3::boolean OR (v.arquivada_em IS NULL AND agenda.proximo_passo_data<=(now() AT TIME ZONE 'America/Sao_Paulo')::date))
        ), numeradas AS (
          SELECT id,(row_number() OVER(ORDER BY id)-1)/100 AS lote FROM selecionadas
        ), lotes AS (
          SELECT array_agg(id) AS ids FROM numeradas GROUP BY lote
        ), resumos AS MATERIALIZED (
          SELECT item AS empresa FROM lotes
          CROSS JOIN LATERAL jsonb_array_elements(empresas_resumos_ler(ids)->'empresas') item
        )
        SELECT s.*,r.empresa FROM selecionadas s LEFT JOIN resumos r ON r.empresa->>'id'=s.id::text
        ORDER BY s.data ASC NULLS LAST,coalesce(r.empresa->>'nome',s.razao_social,s.nome_fantasia),s.id`, [usuarioId, somenteClientes, somenteDevidas])
      const enderecos = await resolverCeps(sql, [...new Set(linhas.flatMap(l => l.cep ? [l.cep] : []))])
      return { ok: true, linhas: linhas.flatMap(l => {
        const empresa = l.empresa ?? undefined
        if (somenteDevidas && (!empresa || empresa.situacao === 'indisponivel')) return []
        return [{ id: l.id, cnpj: l.cnpj, razaoSocial: l.razao_social, nomeFantasia: l.nome_fantasia, cnaePrincipal: l.cnae_principal,
          ultimoContato: l.ultimo_id ? { nota: l.nota, criadoEm: l.criado_em! } : null,
          contatoNome: l.contato_nome, telefone: l.telefone, email: l.email, cep: l.cep, endereco: l.cep ? enderecos.get(l.cep) ?? null : null,
          reservadoAte: null, posse: true, proximoPasso: l.proximo_passo, proximoPassoData: l.data, situacaoRetorno: l.situacao_retorno,
          vencido: l.vencido, situacao: empresa?.situacao ?? l.situacao, versao: l.versao, empresa }]
      }) }
    })
  } catch (erro) {
    if ((erro as { code?: string }).code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}

export function lerAgendaAtendimento(usuarioId: string): Promise<{ ok: true; linhas: EmpresaComigo[] } | { ok: false; motivo: 'sem_permissao' }> {
  return lerEmpresasAtendimento(usuarioId, false, true)
}
