import { ehTipo, EXIGE_POSSE, type Desfecho, type TipoContato } from './tipos'

export type Rascunho = {
  tipo: string
  desfecho: string
  nota: string
  proximoPasso: string
  proximoPassoData: string
  posse: boolean
}

export type Falta = 'tipo_invalido' | 'desfecho_invalido' | 'proximo_passo_exigido' | 'par_incompleto'

export type Validado = {
  tipo: TipoContato
  desfecho: Desfecho
  nota: string | null
  proximoPasso: string | null
  proximoPassoData: string | null
}

const DESFECHOS: readonly string[] = ['nenhum', 'assumir', 'devolver']

function ouNulo(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}

export function validar(r: Rascunho): { ok: true; valor: Validado } | { ok: false; falta: Falta } {
  if (!ehTipo(r.tipo)) return { ok: false, falta: 'tipo_invalido' }
  if (!DESFECHOS.includes(r.desfecho)) return { ok: false, falta: 'desfecho_invalido' }

  const proximoPasso = ouNulo(r.proximoPasso)
  const proximoPassoData = ouNulo(r.proximoPassoData)

  // Espelha `contato_proximo_passo_coerente`. Recusar aqui é o que faz a tela
  // dizer "faltou a data" em vez de deixar o 23514 subir como erro de sistema.
  if ((proximoPasso === null) !== (proximoPassoData === null)) return { ok: false, falta: 'par_incompleto' }

  // Exige onde a empresa CONTINUA com você depois da ação, não onde ela estava
  // antes. Devolver tira a empresa da carteira: não há o que combinar com quem
  // você não vai mais ligar, e exigir ali foi achado da verificação manual.
  const ficaComigo = r.posse && r.desfecho === 'nenhum'
  if (ficaComigo && EXIGE_POSSE[r.tipo] && proximoPasso === null) {
    return { ok: false, falta: 'proximo_passo_exigido' }
  }

  return {
    ok: true,
    valor: { tipo: r.tipo, desfecho: r.desfecho as Desfecho, nota: ouNulo(r.nota), proximoPasso, proximoPassoData },
  }
}
