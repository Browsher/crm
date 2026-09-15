import { comoUsuario } from '../../server/db/como-usuario'
import { ehEtapaFunil, type EtapaFunil } from '../../lib/comercial'

export type NegociacaoResumo = {
  id: string
  empresaId: string
  nome: string
  cidade: string | null
  etapa: EtapaFunil
}
export type NegociacaoDetalhe = NegociacaoResumo & {
  cnpj: string
  uf: string | null
  proximoPasso: string | null
  retorno: string | null
  historico: { id: string; tipo: string; nota: string | null; em: string; proximoPasso: string | null; retorno: string | null }[]
}

// A leitura antiga de contato permite autores anteriores da empresa. O Funil
// tem um contrato mais restrito: posse atual + ciclo próprio + autoria antes
// da serialização, inclusive para o último contato que fornece o retorno.
const ORIGEM = `FROM negociacao n
  JOIN empresa_fila f ON f.empresa_id=n.empresa_id AND f.vendedor_id=$1
  JOIN empresa e ON e.id=n.empresa_id
  LEFT JOIN cep endereco ON endereco.cep=e.cep
  WHERE n.vendedor_id=$1 AND n.encerrada_em IS NULL AND pode_ler()
    AND EXISTS (SELECT 1 FROM usuario u WHERE u.id=$1 AND u.papel='vendedor' AND u.ativo)`

function conferirEtapa<T extends { etapa: string }>(dado: T): T & { etapa: EtapaFunil } {
  if (!ehEtapaFunil(dado.etapa)) throw new Error('Etapa comercial desconhecida')
  return { ...dado, etapa: dado.etapa }
}

export async function lerFunil(usuarioId: string): Promise<NegociacaoResumo[]> {
  return comoUsuario(usuarioId, async executar => {
    const r = await executar<NegociacaoResumo>(`SELECT n.id, n.empresa_id AS "empresaId",
      e.razao_social AS nome, endereco.localidade AS cidade, n.etapa
      ${ORIGEM} ORDER BY n.iniciada_em, n.id`, [usuarioId])
    return r.linhas.map(conferirEtapa)
  })
}

export async function lerNegociacao(usuarioId: string, id: string): Promise<NegociacaoDetalhe | null> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null
  return comoUsuario(usuarioId, async executar => {
    const r = await executar<{ detalhe: NegociacaoDetalhe }>(`
      WITH alvo AS (SELECT n.id,n.empresa_id,e.razao_social AS nome,e.cnpj,
        endereco.localidade AS cidade,endereco.uf,n.etapa ${ORIGEM} AND n.id=$2),
      contatos AS MATERIALIZED (
        SELECT c.id,c.tipo,c.nota,c.criado_em AS em,c.proximo_passo AS "proximoPasso",
          to_char(c.proximo_passo_data,'YYYY-MM-DD') AS retorno
        FROM contato c JOIN alvo a ON a.empresa_id=c.empresa_id
        WHERE c.criado_por=$1
      )
      SELECT jsonb_build_object('id',a.id,'empresaId',a.empresa_id,'nome',a.nome,
        'cnpj',a.cnpj,'cidade',a.cidade,'uf',a.uf,'etapa',a.etapa,
        'proximoPasso',(SELECT c."proximoPasso" FROM contatos c ORDER BY c.em DESC,c.id DESC LIMIT 1),
        'retorno',(SELECT c.retorno FROM contatos c ORDER BY c.em DESC,c.id DESC LIMIT 1),
        'historico',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.em DESC,c.id DESC) FROM contatos c),'[]'::jsonb)
      ) AS detalhe FROM alvo a`, [usuarioId,id])
    return r.linhas[0] ? conferirEtapa(r.linhas[0].detalhe) : null
  })
}

export async function lerTelefoneNegociacao(usuarioId:string,id:string):Promise<string|null> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null
  return comoUsuario(usuarioId,async executar=>{
    const r=await executar<{telefone:string}>(`SELECT e.telefone ${ORIGEM} AND n.id=$2`,[usuarioId,id])
    return r.linhas[0]?.telefone??null
  })
}