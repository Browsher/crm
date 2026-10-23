import { exigir } from '@/src/server/autenticacao/guarda'
import { comoUsuario } from '@/src/server/db/como-usuario'
import type { SocioBanco } from '@/src/lib/banco-empresas'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'

export async function SociosGestor({buscaId,empresaId}:{buscaId?:string;empresaId?:string}) {
  const eu=await exigir('gestor')
  const chave=buscaId??empresaId
  if(!chave||!/^[0-9a-f-]{36}$/i.test(chave))return null
  const linhas=await comoUsuario(eu.usuarioId,async sql=>(await sql<{cnpj:string;dados:(string|SocioBanco)[]}>(
    `SELECT s.cnpj,s.dados FROM busca_empresa_socios s JOIN busca_empresa b ON b.id=s.busca_id
      WHERE eh_gestor() AND ($1::uuid IS NOT NULL AND s.busca_id=$1 OR $2::uuid IS NOT NULL AND s.cnpj=(SELECT e.cnpj FROM empresa e WHERE e.id=$2))
      ORDER BY b.criado_em DESC,b.id DESC`,[buscaId??null,empresaId??null])).linhas)
  if(!linhas.length)return null
  return <Card><CardHeader><CardTitle><h2>Dados dos sócios e representantes</h2></CardTitle><p className="text-sm text-muted-foreground">Acesso exclusivo do gestor. Vendedores recebem somente nome e função.</p></CardHeader><CardContent className="grid gap-5">
    {linhas.map((l,indice)=><section key={l.cnpj+'-'+indice}><h3 className="font-semibold">CNPJ {l.cnpj}</h3><ul className="mt-3 grid gap-4">{l.dados.map((s,i)=><li key={i}>{typeof s==='string'?s:<dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[180px_1fr]">
      <dt>Nome</dt><dd>{s.nome||'Não informado'}</dd><dt>Função</dt><dd>{s.funcao?.descricao||'Não informada'}</dd>
      {s.cnpj_cpf_socio&&<><dt>Documento</dt><dd>{s.cnpj_cpf_socio}</dd></>}{s.data_entrada_sociedade&&<><dt>Entrada na sociedade</dt><dd>{s.data_entrada_sociedade}</dd></>}{s.pais?.descricao&&<><dt>País</dt><dd>{s.pais.descricao}</dd></>}{s.faixa_etariia&&<><dt>Faixa etária</dt><dd>{s.faixa_etariia}</dd></>}
      {s.representante_legal?.nome&&<><dt>Representante legal</dt><dd>{s.representante_legal.nome}</dd></>}{s.representante_legal?.cpf&&<><dt>Documento do representante</dt><dd>{s.representante_legal.cpf}</dd></>}
    </dl>}</li>)}</ul></section>)}
  </CardContent></Card>
}
