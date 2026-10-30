import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerEmpresasPessoais } from '@/src/server/prospeccao-pessoal'
import { lerFiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { ListaSemInteresse } from './lista'
import styles from '../central.module.css'

export default async function PaginaSemInteresse({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const eu=await exigir('vendedor'),params=await searchParams
  const lidos=lerFiltrosPessoais({...Object.fromEntries(['nome','cnpj','pagina'].filter(k=>params[k]!==undefined).map(k=>[k,params[k]])),disponibilidade:'sem_interesse'})
  const r=lidos.ok?await lerEmpresasPessoais(eu.usuarioId,lidos.filtros):{ok:false as const,motivo:'filtros_invalidos'}
  return <main className={styles.pagina}><CabecalhoPagina titulo="Sem interesse" descricao="Consulte as empresas arquivadas e retome o atendimento quando precisar." acoes={<Button asChild variant="outline"><Link href="/fila">Voltar à Prospecção</Link></Button>}/>
    {r.ok&&lidos.ok?<ListaSemInteresse key={eu.usuarioId+JSON.stringify(params)} usuarioId={eu.usuarioId} empresas={r.dados.empresas} total={r.dados.total} filtros={lidos.filtros}/>:<div role="alert"><p>{r.ok||r.motivo==='filtros_invalidos'?'Confira os filtros e tente novamente.':'Você não tem permissão para consultar estas empresas.'}</p><Link href="/fila/sem-interesse">Limpar filtros</Link></div>}
  </main>
}
