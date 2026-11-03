import { repositorioPostgres } from '@/src/features/usuarios/repositorio'
import { exigir } from '@/src/server/autenticacao/guarda'
import { TabelaUsuarios } from './tabela'
import { lerRecorteUsuarios } from '@/src/lib/recorte-usuarios'

export default async function PaginaUsuarios({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
} = {}) {
  const eu = await exigir('gestor')
  const lista = await repositorioPostgres(eu.usuarioId).listar()
  const recorte = lerRecorteUsuarios(await searchParams ?? {})
  return <TabelaUsuarios lista={lista} euId={eu.usuarioId} inicial={recorte} />
}
