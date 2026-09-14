export type FiltrosEmpresas = {
  cnae: string | null
  uf: string | null
  cidade: string | null
  bairro: string | null
}

type Params = Record<string, string | string[] | undefined>

export type ResultadoFiltrosEmpresas =
  | { ok: true; filtros: FiltrosEmpresas }
  | { ok: false; motivo: 'filtro_invalido' }

function primeiro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? ''
  return valor ?? ''
}

export function lerFiltrosEmpresas(params: Params): ResultadoFiltrosEmpresas {
  const cnae = primeiro(params.cnae) || null
  const uf = primeiro(params.uf) || null
  const cidade = primeiro(params.cidade) || null
  const bairro = primeiro(params.bairro) || null

  if (
    [cnae, uf, cidade, bairro].some(valor => valor?.includes('\x00')) ||
    (cnae !== null && cnae !== 'nao_informado' && !/^[0-9]{7}$/.test(cnae)) ||
    (uf !== null && !/^[A-Z]{2}$/.test(uf)) ||
    (cidade !== null && (uf === null || !/^[0-9]{7}$/.test(cidade))) ||
    (bairro !== null && (cidade === null || bairro.trim() === '' || bairro.length > 200))
  ) return { ok: false, motivo: 'filtro_invalido' }

  return { ok: true, filtros: { cnae, uf, cidade, bairro } }
}
