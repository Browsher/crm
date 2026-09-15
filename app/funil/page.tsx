import { exigir } from '@/src/server/autenticacao/guarda'
import { lerFunil } from '@/src/features/funil/consulta'
import { Quadro } from './quadro'
import styles from './funil.module.css'
export default async function PaginaFunil() {
  const eu=await exigir('vendedor')
  const linhas=await lerFunil(eu.usuarioId)
  return <main className={styles.pagina}><header><h1>Funil comercial</h1><p>Acompanhe suas negociações até a primeira venda.</p></header><Quadro linhas={linhas} /></main>
}
