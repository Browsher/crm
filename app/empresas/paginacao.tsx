import Link from 'next/link'

// URLSearchParams e não template: o termo pode ter acento, espaço e `&`, e
// montar a query à mão é como se perde a busca ao virar a página.
function endereco(termo: string, pagina: number): string {
  const params = new URLSearchParams()
  if (termo) params.set('q', termo)
  params.set('pagina', String(pagina))
  return `/empresas?${params.toString()}`
}

export function Paginacao({ pagina, paginas, termo }: { pagina: number; paginas: number; termo: string }) {
  if (paginas <= 1) return null
  return (
    <nav className="flex items-center justify-between text-sm">
      {pagina > 1 ? (
        <Link href={endereco(termo, pagina - 1)} className="underline">
          Anterior
        </Link>
      ) : (
        <span className="text-neutral-400">Anterior</span>
      )}
      <span>
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <Link href={endereco(termo, pagina + 1)} className="underline">
          Próxima
        </Link>
      ) : (
        <span className="text-neutral-400">Próxima</span>
      )}
    </nav>
  )
}
