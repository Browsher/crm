import { exigir } from '@/src/server/autenticacao/guarda'
import { comoUsuario } from '@/src/server/db/como-usuario'
import type { SocioBanco } from '@/src/lib/banco-empresas'
import { DadosSocios, type LinhaSocios } from './dados-socios'

type Referencia = { buscaId?: string; empresaId?: string }

export async function lerSociosGestor(usuarioId: string, { buscaId, empresaId }: Referencia): Promise<LinhaSocios[]> {
  const chave=buscaId??empresaId
  if(!chave||!/^[0-9a-f-]{36}$/i.test(chave))return []
  const linhas=await comoUsuario(usuarioId,async sql=>(await sql<{cnpj:string;dados:(string|SocioBanco)[]}>(
    `SELECT s.cnpj,s.dados FROM busca_empresa_socios s JOIN busca_empresa b ON b.id=s.busca_id
      WHERE eh_gestor() AND ($1::uuid IS NOT NULL AND s.busca_id=$1 OR $2::uuid IS NOT NULL AND s.cnpj=(SELECT e.cnpj FROM empresa e WHERE e.id=$2))
      ORDER BY b.criado_em DESC,b.id DESC`,[buscaId??null,empresaId??null])).linhas)
  return linhas.map(({ cnpj, dados }) => ({ cnpj, dados: dados.map(socio => typeof socio === 'string' ? socio : {
    nome: socio.nome, funcao: socio.funcao?.descricao, documento: socio.cnpj_cpf_socio,
    entrada: socio.data_entrada_sociedade, pais: socio.pais?.descricao, faixaEtaria: socio.faixa_etariia,
    representante: socio.representante_legal?.nome, documentoRepresentante: socio.representante_legal?.cpf,
  }) }))
}

export async function SociosGestor(referencia: Referencia) {
  const eu = await exigir('gestor')
  return <DadosSocios linhas={await lerSociosGestor(eu.usuarioId, referencia)} />
}
