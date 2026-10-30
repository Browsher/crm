import { comoUsuario } from '../../server/db/como-usuario'
import { ehEtapaFunil, type EtapaFunil } from '../../lib/comercial'
import type { ResumoEmpresa } from '../../lib/empresa-visual'
import { lerResumosEmpresas } from '../../server/atendimento/consulta'

export type NegociacaoResumo = {
  id: string
  empresaId: string
  nome: string
  cidade: string | null
  etapa: EtapaFunil
  versao: number
  empresa: ResumoEmpresa
}
export type NegociacaoDetalhe = NegociacaoResumo & {
  cnpj: string | null
  uf: string | null
  proximoPasso: string | null
  retorno: string | null
  historico: { id: string; tipo: string; nota: string | null; em: string; proximoPasso: string | null; retorno: string | null }[]
}

// A leitura antiga de contato permite autores anteriores da empresa. O Funil
// tem um contrato mais restrito: posse atual + ciclo próprio + autoria antes
// da serialização. A agenda vigente é independente da autoria do histórico.
const ORIGEM = `FROM negociacao n
  JOIN empresa_fila f ON f.empresa_id=n.empresa_id AND f.vendedor_id=$1
  JOIN empresa e ON e.id=n.empresa_id
  LEFT JOIN cep endereco ON endereco.cep=e.cep
  WHERE n.vendedor_id=$1 AND n.encerrada_em IS NULL AND pode_ler() AND NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=e.id)
    AND EXISTS (SELECT 1 FROM usuario u WHERE u.id=$1 AND u.papel='vendedor' AND u.ativo)`

function conferirEtapa<T extends { etapa: string }>(dado: T): T & { etapa: EtapaFunil } {
  if (!ehEtapaFunil(dado.etapa)) throw new Error('Etapa comercial desconhecida')
  return { ...dado, etapa: dado.etapa }
}

export async function lerFunil(usuarioId: string): Promise<NegociacaoResumo[]> {
  const linhas=await comoUsuario(usuarioId, async executar => {
    const r = await executar<NegociacaoResumo>(`SELECT n.id, n.empresa_id AS "empresaId",
      coalesce(e.razao_social,e.nome_fantasia) AS nome, endereco.localidade AS cidade, n.etapa
      ${ORIGEM} ORDER BY n.iniciada_em, n.id`, [usuarioId])
    return r.linhas.map(conferirEtapa)
  })
  const empresas:ResumoEmpresa[]=[]
  for(let inicio=0;inicio<linhas.length;inicio+=100){
    const r=await lerResumosEmpresas(usuarioId,linhas.slice(inicio,inicio+100).map(l=>l.empresaId))
    if(!r.ok)return []
    empresas.push(...r.empresas)
  }
  const porId=new Map(empresas.map(e=>[e.id,e]))
  return linhas.flatMap(l=>{const empresa=porId.get(l.empresaId);return empresa&&empresa.versao? [{...l,empresa,versao:empresa.versao}]:[]})
}

export async function contarSemInteresse(usuarioId:string):Promise<{ok:true;total:number}|{ok:false;motivo:'sem_permissao'}> {
  return comoUsuario(usuarioId,async sql=>{
    const {linhas}=await sql<{permitido:boolean;total:number}>(`SELECT
      (pode_ler() AND EXISTS(SELECT 1 FROM usuario WHERE id=usuario_atual() AND papel='vendedor' AND ativo)) AS permitido,
      (SELECT count(*)::integer FROM empresa_vinculo v WHERE vendedor_id=usuario_atual() AND arquivada_em IS NOT NULL AND NOT EXISTS(SELECT 1 FROM empresa_arquivo WHERE empresa_id=v.empresa_id)) AS total`)
    const r=linhas[0]
    return r?.permitido?{ok:true,total:r.total}:{ok:false,motivo:'sem_permissao'}
  })
}

export async function lerNegociacao(usuarioId: string, id: string): Promise<NegociacaoDetalhe | null> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null
  const detalhe=await comoUsuario(usuarioId, async executar => {
    const r = await executar<{ detalhe: NegociacaoDetalhe }>(`
      WITH alvo AS (SELECT n.id,n.empresa_id,coalesce(e.razao_social,e.nome_fantasia) AS nome,e.cnpj,
        endereco.localidade AS cidade,endereco.uf,n.etapa ${ORIGEM} AND n.id=$2),
      contatos AS MATERIALIZED (
        SELECT c.id,c.tipo,c.nota,c.criado_em AS em,c.proximo_passo AS "proximoPasso",
          to_char(c.proximo_passo_data,'YYYY-MM-DD') AS retorno
        FROM contato c JOIN alvo a ON a.empresa_id=c.empresa_id
        WHERE c.criado_por=$1
      ), agenda AS (
        SELECT c.proximo_passo,to_char(c.proximo_passo_data,'YYYY-MM-DD') AS retorno
        FROM alvo a JOIN empresa_vinculo v ON v.empresa_id=a.empresa_id AND v.vendedor_id=$1
        JOIN contato c ON c.id=v.agenda_contato_id AND c.empresa_id=v.empresa_id
        WHERE v.arquivada_em IS NULL
      )
      SELECT jsonb_build_object('id',a.id,'empresaId',a.empresa_id,'nome',a.nome,
        'cnpj',a.cnpj,'cidade',a.cidade,'uf',a.uf,'etapa',a.etapa,
        'proximoPasso',(SELECT proximo_passo FROM agenda),
        'retorno',(SELECT retorno FROM agenda),
        'historico',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.em DESC,c.id DESC) FROM contatos c),'[]'::jsonb)
      ) AS detalhe FROM alvo a`, [usuarioId,id])
    return r.linhas[0] ? conferirEtapa(r.linhas[0].detalhe) : null
  })
  if(!detalhe)return null
  const r=await lerResumosEmpresas(usuarioId,[detalhe.empresaId])
  const empresa=r.ok?r.empresas.find(e=>e.id===detalhe.empresaId):null
  if(!empresa?.versao)return null
  const agendaDisponivel=empresa.situacao!=='indisponivel'&&empresa.situacao!=='sem_interesse'
  return {...detalhe,empresa,versao:empresa.versao,
    proximoPasso:agendaDisponivel?detalhe.proximoPasso:null,retorno:agendaDisponivel?detalhe.retorno:null}
}

export async function lerTelefoneNegociacao(usuarioId:string,id:string):Promise<string|null> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null
  return comoUsuario(usuarioId,async executar=>{
    const r=await executar<{telefone:string|null}>(`SELECT e.telefone ${ORIGEM} AND n.id=$2`,[usuarioId,id])
    return r.linhas[0] ? r.linhas[0].telefone ?? '' : null
  })
}

export async function lerEmpresaArquivadaDaNegociacao(usuarioId: string, id: string): Promise<string | null> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null
  return comoUsuario(usuarioId, async executar => {
    const { linhas } = await executar<{ empresa_id: string }>(`SELECT n.empresa_id FROM negociacao n
      JOIN empresa_arquivo a ON a.empresa_id=n.empresa_id
      WHERE n.id=$1 AND n.vendedor_id=usuario_atual() AND pode_ler()`, [id])
    return linhas[0]?.empresa_id ?? null
  })
}
