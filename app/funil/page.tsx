import { exigir } from '@/src/server/autenticacao/guarda'
import { lerFunil, contarSemInteresse } from '@/src/features/funil/consulta'
import { Quadro } from './quadro'
import styles from './funil.module.css'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
export default async function PaginaFunil({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const eu=await exigir('vendedor')
  const [linhas,total,params]=await Promise.all([lerFunil(eu.usuarioId),contarSemInteresse(eu.usuarioId),searchParams])
  const inicial=typeof params.negociacao==='string'?params.negociacao:null
  return <main className={styles.pagina}><CabecalhoPagina titulo="Funil comercial" descricao="Acompanhe suas negociações até a primeira venda." />{total.ok?<Quadro key={eu.usuarioId} usuarioId={eu.usuarioId} linhas={linhas} totalSemInteresse={total.total} negociacaoInicial={inicial}/>:<p role="alert">Você não tem permissão para consultar o Funil.</p>}</main>
}
