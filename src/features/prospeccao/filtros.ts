import type { Filtros } from './tipos'

export type { Filtros } from './tipos'

type Params = Record<string, string | string[] | undefined>
type ResultadoFiltros =
  | { ok: true; filtros: Filtros }
  | { ok: false; motivo: 'filtro_invalido' }

function primeiro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? ''
  return valor ?? ''
}

export function lerFiltros(params: Params): ResultadoFiltros {
  const nomeOriginal = primeiro(params.nome)
  const cnae = primeiro(params.cnae) || null
  const uf = primeiro(params.uf) || null
  const cidade = primeiro(params.cidade) || null
  const bairro = primeiro(params.bairro) || null
  const paginaOriginal = primeiro(params.pagina)
  const nome = nomeOriginal.trim()
  const pagina = paginaOriginal === '' ? 1 : Number(paginaOriginal)

  if (
    [nomeOriginal, cnae, uf, cidade, bairro, paginaOriginal].some(valor => valor?.includes('\x00')) ||
    nome.length > 100 ||
    (cnae !== null && cnae !== 'nao_informado' && !/^[0-9]{7}$/.test(cnae)) ||
    (uf !== null && !/^[A-Z]{2}$/.test(uf)) ||
    (cidade !== null && (uf === null || !/^[0-9]{7}$/.test(cidade))) ||
    (bairro !== null && (cidade === null || bairro.trim() === '' || bairro.length > 200)) ||
    (paginaOriginal !== '' && !/^[0-9]+$/.test(paginaOriginal)) ||
    !Number.isInteger(pagina) || pagina < 1 || pagina > 10000
  ) return { ok: false, motivo: 'filtro_invalido' }

  return { ok: true, filtros: { nome, cnae, uf, cidade, bairro, pagina } }
}
