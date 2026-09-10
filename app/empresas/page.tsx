import Link from 'next/link'
import { redirect } from 'next/navigation'
import { destinoCanonico, lerConsulta, totalDePaginas } from '@/src/features/empresas/consulta'
import { listarEmpresas } from '@/src/features/empresas/listagem'
import { textoDoMotivo } from '@/src/features/empresas/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Lista } from './lista'
import { Paginacao } from './paginacao'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PaginaEmpresas({ searchParams }: Props) {
  const eu = await exigir('gestor')
  const params = await searchParams
  // Antes de consultar: se a URL não está canônica, a ida ao banco seria
  // jogada fora pelo redirecionamento.
  const destino = destinoCanonico(params)
  if (destino) redirect(destino)
  const consulta = lerConsulta(params)
  const resultado = await listarEmpresas(eu.usuarioId, consulta)
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empresas</h1>
        <nav className="flex items-center gap-3">
          <Link href="/empresas/importar" className="text-sm underline">
            Importar
          </Link>
          <Link href="/" className="text-sm underline">
            Início
          </Link>
        </nav>
      </header>
      {/* O formulário não carrega `pagina`: buscar volta para a primeira
          página, que é o que se espera de uma busca nova. */}
      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={consulta.termo}
          placeholder="Razão social, nome fantasia ou CNPJ"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded border px-3 py-2 text-sm">
          Buscar
        </button>
      </form>
      {resultado.ok ? (
        <>
          <p className="text-sm text-neutral-600">
            {resultado.total} {resultado.total === 1 ? 'empresa' : 'empresas'}
          </p>
          <Lista linhas={resultado.linhas} />
          <Paginacao pagina={consulta.pagina} paginas={totalDePaginas(resultado.total)} termo={consulta.termo} />
        </>
      ) : (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{textoDoMotivo(resultado.motivo)}</p>
      )}
    </main>
  )
}
