import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Button } from '@/src/components/ui/button'
import { FormularioImportar } from './formulario'
import styles from './importar.module.css'

export default async function PaginaImportarEmpresas() {
  await exigir('gestor')
  return <main className={styles.pagina}>
    <header className={styles.cabecalho}>
      <div><h1>Importar empresas</h1><p>Confira os dados antes de adicionar à sua base.</p></div>
      <Button asChild variant="outline"><Link href="/empresas">Voltar para empresas</Link></Button>
    </header>
    <FormularioImportar />
  </main>
}
