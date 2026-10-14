import type { IdentidadeImportada, Preparo } from './repositorio'

type Resultado = { ok: true; empresaId: string | null } | {
  ok: false; motivo: 'identificadores_divergentes' | 'cnpj_divergente' | 'razao_social_divergente'
}

export function resolverIdentidade(linha: IdentidadeImportada, preparo: Pick<Preparo, 'porCnpj' | 'porGoogle'>): Resultado {
  const porCnpj = linha.cnpj === null ? undefined : preparo.porCnpj.get(linha.cnpj)
  const porGoogle = linha.googlePlaceId === null ? undefined : preparo.porGoogle.get(linha.googlePlaceId)
  if (porCnpj && porGoogle && porCnpj.id !== porGoogle.id) return { ok: false, motivo: 'identificadores_divergentes' }
  const existente = porGoogle ?? porCnpj
  if (existente?.cnpj && linha.cnpj && existente.cnpj !== linha.cnpj) return { ok: false, motivo: 'cnpj_divergente' }
  if (existente?.razaoSocial && linha.razaoSocial && existente.razaoSocial !== linha.razaoSocial) return { ok: false, motivo: 'razao_social_divergente' }
  return { ok: true, empresaId: existente?.id ?? null }
}
