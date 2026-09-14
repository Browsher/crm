import Link from 'next/link'
import { enderecoEmpresas, type ConsultaEmpresas } from '@/src/features/empresas/consulta'
import styles from './empresas.module.css'

export function Paginacao({ consulta, paginas }: { consulta: ConsultaEmpresas; paginas: number }) {
  const { pagina } = consulta
  if (paginas <= 1) return null
  return (
    <nav aria-label="Paginação de empresas" className={styles.paginacao}>
      {pagina > 1 ? (
        <Link href={enderecoEmpresas(consulta, pagina - 1)} className="underline">
          Anterior
        </Link>
      ) : (
        <span aria-disabled="true">Anterior</span>
      )}
      <span>
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <Link href={enderecoEmpresas(consulta, pagina + 1)} className="underline">
          Próxima
        </Link>
      ) : (
        <span aria-disabled="true">Próxima</span>
      )}
    </nav>
  )
}
