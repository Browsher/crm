import Link from 'next/link'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { urlConsulta } from './navegacao'

export function Paginacao({ filtros, temProxima }: { filtros: Filtros; temProxima: boolean }) {
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center gap-4 text-sm">
      {filtros.pagina > 1 && <Link href={urlConsulta(filtros, filtros.pagina - 1)} className="underline">Anterior</Link>}
      <span>Página {filtros.pagina}</span>
      {temProxima && filtros.pagina < 10000 && <Link href={urlConsulta(filtros, filtros.pagina + 1)} className="underline">Próxima página</Link>}
    </nav>
  )
}
