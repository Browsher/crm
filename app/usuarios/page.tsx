import { repositorioPostgres } from '@/src/features/usuarios/repositorio'
import { exigir } from '@/src/server/autenticacao/guarda'
import { TabelaUsuarios } from './tabela'

export default async function PaginaUsuarios() {
  const eu = await exigir('gestor')
  const lista = await repositorioPostgres(eu.usuarioId).listar()
  return <TabelaUsuarios lista={lista} euId={eu.usuarioId} />
}
