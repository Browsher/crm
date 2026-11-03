import Link from 'next/link'
import { redirect } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { urlPessoal } from '@/src/lib/prospeccao-pessoal'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { lerConsultaPessoal } from '../localizar/navegacao'
import { RecuperacaoRetomada } from '../localizar/recuperacao-retomada'
import styles from '../central.module.css'

export default async function PaginaSemInteresse({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const eu=await exigir('vendedor')
  const params=await searchParams
  const lidos=lerConsultaPessoal(params,true)
  if(lidos.ok) redirect(urlPessoal(lidos.filtros,Number(lidos.filtros.pagina||1),params.pesquisado==='1'))
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Localizar empresas" descricao="Consulte suas empresas sem interesse." />
    <RecuperacaoRetomada key={eu.usuarioId} usuarioId={eu.usuarioId} filtros={{disponibilidade:'sem_interesse'}}>
      <div role="alert"><p>Um dos filtros é inválido. Limpe os filtros e tente novamente.</p><Button asChild variant="outline"><Link href={urlPessoal({disponibilidade:'sem_interesse'})}>Limpar filtros</Link></Button></div>
    </RecuperacaoRetomada>
  </main>
}
