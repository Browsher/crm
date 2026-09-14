import { comoUsuario } from '../../server/db/como-usuario'

export type PerfilEmpresa = {
  id: string; cnpj: string; razaoSocial: string; nomeFantasia: string | null
  contatoNome: string | null; telefone: string; email: string | null; cnae: string | null
  cep: string | null; logradouro: string | null; bairro: string | null; cidade: string | null; uf: string | null
  responsavel: string | null; responsavelAtivo: boolean | null
  reservadoPor: string | null; reservadoAte: Date | null
  situacao: 'carteira' | 'reservada' | 'inativa' | 'descanso' | 'disponivel'
  proximoPasso: string | null; retorno: string | null
  grupos: { id: string; nome: string; ativo: boolean }[]
}

export async function lerPerfilEmpresa(gestorId: string, empresaId: string): Promise<PerfilEmpresa | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empresaId)) return null
  return comoUsuario(gestorId, async executar => {
    const { linhas } = await executar<PerfilEmpresa>(`
      SELECT e.id,e.cnpj,e.razao_social AS "razaoSocial",e.nome_fantasia AS "nomeFantasia",
        e.contato_nome AS "contatoNome",e.telefone,e.email,e.cnae_principal AS cnae,
        e.cep,c.logradouro,c.bairro,c.localidade AS cidade,c.uf,
        dono.nome AS responsavel,dono.ativo AS "responsavelAtivo",
        CASE WHEN f.reservado_ate>now() THEN reserva.nome END AS "reservadoPor",
        CASE WHEN f.reservado_ate>now() THEN f.reservado_ate END AS "reservadoAte",
        CASE WHEN dono.ativo THEN 'carteira'
          WHEN f.reservado_ate>now() THEN 'reservada'
          WHEN NOT coalesce(origem.ativa,false) THEN 'inativa'
          WHEN f.elegivel_em>now() THEN 'descanso' ELSE 'disponivel' END AS situacao,
        ultimo.proximo_passo AS "proximoPasso",to_char(ultimo.proximo_passo_data,'YYYY-MM-DD') AS retorno,
        coalesce(origem.grupos,'[]'::jsonb) AS grupos
      FROM empresa e LEFT JOIN cep c ON c.cep=e.cep
      LEFT JOIN empresa_fila f ON f.empresa_id=e.id
      LEFT JOIN usuario dono ON dono.id=f.vendedor_id
      LEFT JOIN usuario reserva ON reserva.id=f.reservado_por
      LEFT JOIN LATERAL (
        SELECT proximo_passo,proximo_passo_data FROM contato WHERE empresa_id=e.id
        ORDER BY criado_em DESC,id DESC LIMIT 1
      ) ultimo ON true
      LEFT JOIN LATERAL (
        SELECT bool_or(g.ativo) AS ativa,
          jsonb_agg(jsonb_build_object('id',g.id,'nome',g.nome,'ativo',g.ativo) ORDER BY g.nome,g.id) AS grupos
        FROM grupo_importacao_empresa ge JOIN grupo_importacao g ON g.id=ge.grupo_id WHERE ge.empresa_id=e.id
      ) origem ON true
      WHERE e.id=$1 AND eh_gestor()`, [empresaId])
    return linhas[0] ?? null
  })
}
