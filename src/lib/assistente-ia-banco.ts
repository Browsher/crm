import type { PublicoSugerido, RegiaoSugerida } from './assistente-ia'
import type { FiltrosBanco } from './banco-empresas'

export type CnaeConfirmado = { codigo: string; descricao: string }
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

export function regiaoSugeridaBanco(regiao: RegiaoSugerida): FiltrosBanco['regioes'][number] {
  return { estado: regiao.uf, cidade: regiao.cidade, bairros: regiao.bairro ? [regiao.bairro] : [] }
}
