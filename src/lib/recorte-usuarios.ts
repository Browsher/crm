export const USUARIOS_POR_PAGINA = 25

export type RecorteUsuarios = {
  busca: string
  papel: 'todos' | 'gestor' | 'vendedor'
  situacao: 'todos' | 'ativos' | 'inativos'
  pagina: number
}

type Consulta = Record<string, string | string[] | undefined>
type Chave = 'busca' | 'papel' | 'situacao' | 'pagina' | 'paginaLista'

export function lerRecorteUsuarios(consulta: Consulta | URLSearchParams, noPerfil = false): RecorteUsuarios {
  const ler = (chave: Chave) => {
    const valores = consulta instanceof URLSearchParams ? consulta.getAll(chave) : consulta[chave]
    return Array.isArray(valores) && consulta instanceof URLSearchParams && valores.length === 1 ? valores[0] : valores
  }
  const busca = ler('busca')
  const papel = ler('papel')
  const situacao = ler('situacao')
  const pagina = ler(noPerfil ? 'paginaLista' : 'pagina')
  return {
    busca: typeof busca === 'string' && busca.length <= 160 && !/\p{Cc}/u.test(busca) ? busca : '',
    papel: papel === 'gestor' || papel === 'vendedor' ? papel : 'todos',
    situacao: situacao === 'ativos' || situacao === 'inativos' ? situacao : 'todos',
    pagina: typeof pagina === 'string' && /^[1-9][0-9]{0,8}$/.test(pagina) ? Number(pagina) : 1,
  }
}

function parametros(recorte: RecorteUsuarios, noPerfil: boolean) {
  const query = new URLSearchParams()
  const busca = recorte.busca.trim()
  if (busca && busca.length <= 160 && !/\p{Cc}/u.test(busca)) query.set('busca', busca)
  if (recorte.papel !== 'todos') query.set('papel', recorte.papel)
  if (recorte.situacao !== 'todos') query.set('situacao', recorte.situacao)
  if (recorte.pagina > 1) query.set(noPerfil ? 'paginaLista' : 'pagina', String(recorte.pagina))
  return query
}

export function urlUsuarios(recorte: RecorteUsuarios) {
  const query = parametros(recorte, false).toString()
  return query ? '/usuarios?' + query : '/usuarios'
}

export function urlPerfilUsuario(id: string, recorte: RecorteUsuarios, paginaPerfil?: number) {
  const query = parametros(recorte, true)
  if (paginaPerfil !== undefined) query.set('pagina', String(paginaPerfil))
  const caminho = '/usuarios/vendedores/' + encodeURIComponent(id)
  return query.size ? caminho + '?' + query : caminho
}
