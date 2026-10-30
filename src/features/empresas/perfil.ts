import { comoUsuario } from '../../server/db/como-usuario'
import type { ResumoEmpresaGestor, SituacaoEmpresa } from '../../lib/empresa-visual'

export type PerfilEmpresa = {
  id: string; cnpj: string | null; razaoSocial: string | null; nomeFantasia: string | null
  contatoNome: string | null; telefone: string | null; email: string | null; cnae: string | null
  cep: string | null; logradouro: string | null; bairro: string | null; cidade: string | null; uf: string | null
  responsavel: string | null; responsavelAtivo: boolean | null
  nome: string; resumo: ResumoEmpresaGestor
  situacao: SituacaoEmpresa
  proximoPasso: string | null; retorno: string | null
  grupos: { id: string; nome: string; ativo: boolean }[]
  arquivo?: { arquivadaEm: string; negociacoes: { id: string; etapa: string; encerradaEm: string; encerramento: string; vendedor: string | null }[] } | null
}

export async function lerPerfilEmpresa(gestorId: string, empresaId: string): Promise<PerfilEmpresa | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empresaId)) return null
  return comoUsuario(gestorId, async executar => {
    const { linhas } = await executar<PerfilEmpresa>(`
      WITH resumo AS MATERIALIZED (
        SELECT e.id,(gestor_empresas_resumos_ler(ARRAY[e.id])->'empresas')->0 AS dados
        FROM empresa e WHERE e.id=$1 AND eh_gestor()
      )
      SELECT e.id,e.cnpj,e.razao_social AS "razaoSocial",e.nome_fantasia AS "nomeFantasia",
        e.contato_nome AS "contatoNome",e.telefone,e.email,e.cnae_principal AS cnae,
        e.cep,c.logradouro,resumo.dados->>'bairro' AS bairro,resumo.dados->>'cidade' AS cidade,resumo.dados->>'uf' AS uf,
        resumo.dados AS resumo,resumo.dados->>'nome' AS nome,resumo.dados->>'situacao' AS situacao,
        resumo.dados->'responsavel'->>'nome' AS responsavel,(resumo.dados->'responsavel'->>'ativo')::boolean AS "responsavelAtivo",
        agenda.proximo_passo AS "proximoPasso",to_char(agenda.proximo_passo_data,'YYYY-MM-DD') AS retorno,
        coalesce(origem.grupos,'[]'::jsonb) AS grupos,
        CASE WHEN arquivo.empresa_id IS NOT NULL THEN jsonb_build_object('arquivadaEm',arquivo.arquivada_em,
          'negociacoes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'etapa',n.etapa,'encerradaEm',n.encerrada_em,'encerramento',n.encerramento,'vendedor',autor.nome) ORDER BY n.iniciada_em,n.id)
            FROM negociacao n LEFT JOIN usuario autor ON autor.id=n.vendedor_id WHERE n.empresa_id=e.id),'[]'::jsonb)) END AS arquivo
      FROM empresa e LEFT JOIN cep c ON c.cep=e.cep
      JOIN resumo ON resumo.id=e.id
      LEFT JOIN empresa_arquivo arquivo ON arquivo.empresa_id=e.id
      LEFT JOIN empresa_vinculo v ON v.empresa_id=e.id
      LEFT JOIN contato agenda ON agenda.id=v.agenda_contato_id AND agenda.empresa_id=e.id AND v.arquivada_em IS NULL
        AND resumo.dados->>'situacao'<>'indisponivel'
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('id',g.id,'nome',g.nome,'ativo',g.ativo) ORDER BY g.nome,g.id) AS grupos
        FROM grupo_importacao_empresa ge JOIN grupo_importacao g ON g.id=ge.grupo_id WHERE ge.empresa_id=e.id
      ) origem ON true
      WHERE e.id=$1 AND eh_gestor()`, [empresaId])
    return linhas[0] ?? null
  })
}
