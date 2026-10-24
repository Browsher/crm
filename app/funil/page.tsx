import { exigir } from '@/src/server/autenticacao/guarda'
import { lerFunil } from '@/src/features/funil/consulta'
import { Quadro } from './quadro'
import styles from './funil.module.css'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
export default async function PaginaFunil() {
  const eu=await exigir('vendedor')
  const linhas=await lerFunil(eu.usuarioId)
  return <main className={styles.pagina}><CabecalhoPagina titulo="Funil comercial" descricao="Acompanhe suas negociações até a primeira venda." /><Quadro linhas={linhas} /></main>
}
