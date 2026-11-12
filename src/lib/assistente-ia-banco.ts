import type { PublicoSugerido } from './assistente-ia'
import type { FiltrosBanco } from './banco-empresas'

export type CnaeConfirmado = { codigo: string; descricao: string; amplo?: boolean; motivo?: string }
export type SugestaoBanco = PublicoSugerido & {
  cnaes?: CnaeConfirmado[]
  cnaesSecundarios?: CnaeConfirmado[]
  palavras?: string[]
}

export function camposSugeridosBanco(sugestao: SugestaoBanco): Partial<FiltrosBanco> {
  return {
    ...(sugestao.palavras?.length && { palavras: sugestao.palavras }),
    ...(sugestao.cnaes?.length && { cnaes: sugestao.cnaes.map(cnae => cnae.codigo) }),
    ...(sugestao.cnaesSecundarios?.length && { cnaesSecundarios: sugestao.cnaesSecundarios.map(cnae => cnae.codigo) }),
  }
}
