import Link from 'next/link'
import { redirect } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerEmpresasPessoais } from '@/src/server/prospeccao-pessoal'
import { urlPessoal } from '@/src/lib/prospeccao-pessoal'
import { lerConsultaPessoal } from './navegacao'
import { RecuperacaoRetomada } from './recuperacao-retomada'
import { Button } from '@/src/components/ui/button'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { LocalizarPessoal } from './pessoal'
import styles from '../central.module.css'

export default async function PaginaLocalizar({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const eu=await exigir('vendedor')
  const params=await searchParams
  const lidos=lerConsultaPessoal(params)
  if(lidos.ok && params.origem==='sem_interesse') redirect(urlPessoal(lidos.filtros,Number(lidos.filtros.pagina||1),params.pesquisado==='1'))
  const filtros=lidos.ok?lidos.filtros:{}
  const recolhido=params.pesquisado==='1'
  const resultado = !lidos.ok ? {ok:false as const,motivo:'filtros_invalidos' as const} : await lerEmpresasPessoais(eu.usuarioId,filtros)
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Localizar empresas" descricao="Encontre suas empresas por nicho e bairro para continuar os atendimentos." acoes={<Button asChild variant="outline"><Link href="/fila">Voltar às opções</Link></Button>} />
    <RecuperacaoRetomada key={eu.usuarioId} usuarioId={eu.usuarioId} filtros={filtros} consultaRecolhida={recolhido}>
    {resultado.ok?<LocalizarPessoal key={JSON.stringify(params)} filtros={filtros} dados={resultado.dados} recolhido={recolhido}/>:<div role="alert"><p>{resultado.motivo==='filtros_invalidos'?'Um dos filtros é inválido. Limpe os filtros e tente novamente.':'Você não tem permissão para consultar estas empresas.'}</p><Button asChild variant="outline"><Link href={urlPessoal({disponibilidade:params.disponibilidade==='sem_interesse'||params.origem==='sem_interesse'?'sem_interesse':undefined})}>Limpar filtros</Link></Button></div>}
    </RecuperacaoRetomada>
  </main>
}
