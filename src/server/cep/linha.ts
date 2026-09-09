export type LinhaCep = {
  cep: string
  logradouro: string | null
  faixa: string | null
  bairro: string | null
  localidade: string
  uf: string
  ibge: string
}

const vazioViraNulo = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

// O campo `complemento` do arquivo dos Correios NÃO é complemento de endereço:
// é o trecho da rua que o CEP cobre ('lado ímpar', 's/n'). Vira `faixa` aqui,
// para não colidir com empresa.complemento, que significa 'sala 302'.
export function linhaDoJson(texto: string): LinhaCep | null {
  let d: Record<string, unknown>
  try {
    d = JSON.parse(texto) as Record<string, unknown>
  } catch {
    return null
  }
  const cep = (vazioViraNulo(d.cep) ?? '').replace(/-/g, '')
  const localidade = vazioViraNulo(d.localidade)
  const uf = vazioViraNulo(d.uf)?.toUpperCase() ?? null
  const ibge = vazioViraNulo(d.ibge)
  if (!/^[0-9]{8}$/.test(cep)) return null
  if (localidade === null) return null
  if (uf === null || !/^[A-Z]{2}$/.test(uf)) return null
  if (ibge === null || !/^[0-9]{7}$/.test(ibge)) return null
  return {
    cep,
    logradouro: vazioViraNulo(d.logradouro),
    faixa: vazioViraNulo(d.complemento),
    bairro: vazioViraNulo(d.bairro),
    localidade,
    uf,
    ibge,
  }
}

// No COPY ... WITH (FORMAT csv) o campo vazio SEM aspas é NULL e `""` é string
// vazia. linhaDoJson já transformou vazio em null, então pelo caminho do zip a
// ambiguidade não aparece — mas campoCsv é utilitário geral, e sem a guarda de
// string vazia ela sairia crua e viraria NULL em silêncio no banco.
export function campoCsv(v: string | null): string {
  if (v === null) return ''
  if (v === '') return '""'
  return /["\n\r,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function paraCsv(l: LinhaCep): string {
  const campos = [l.cep, l.logradouro, l.faixa, l.bairro, l.localidade, l.uf, l.ibge]
  return `${campos.map(campoCsv).join(',')}\n`
}
