import type { PublicoSugerido } from './assistente-ia'
import { bancoInicial, lerBanco, schemaBanco, type FiltrosBanco } from './banco-empresas'

export type CnaeConfirmado = { codigo: string; descricao: string; amplo?: boolean; motivo?: string }
type FiltroSugerido<T> = { valor: T; motivo: string }
type PorteComum = Exclude<FiltrosBanco['portes'][number], 'MEI'>
type ContatoSugerido = Exclude<FiltrosBanco['contato'], '' | 'telefoneoucelularouemail'>

export type PerfilEmpresaSugerido = {
  portes?: FiltroSugerido<PorteComum[]>
  mei?: FiltroSugerido<'qualquer' | 'somente' | 'excluir'>
  regime?: FiltroSugerido<'qualquer' | 'simples' | 'fora_simples'>
  estabelecimento?: FiltroSugerido<'matriz' | 'filial'>
  aberturaUltimosDias?: FiltroSugerido<number>
  contato?: FiltroSugerido<ContatoSugerido>
}

export type SugestaoBanco = PublicoSugerido & {
  cnaes?: CnaeConfirmado[]
  cnaesSecundarios?: CnaeConfirmado[]
  palavras?: string[]
  perfilEmpresa?: PerfilEmpresaSugerido
}

export type SelecaoPerfilBanco = {
  campos: (keyof PerfilEmpresaSugerido)[]
  capitalMinimo?: string
  capitalMaximo?: string
}

function camposSugeridosBanco(sugestao: SugestaoBanco): Partial<FiltrosBanco> {
  return {
    ...(sugestao.palavras?.length && { palavras: sugestao.palavras }),
    ...(sugestao.cnaes?.length && { cnaes: sugestao.cnaes.map(cnae => cnae.codigo) }),
    ...(sugestao.cnaesSecundarios?.length && { cnaesSecundarios: sugestao.cnaesSecundarios.map(cnae => cnae.codigo) }),
  }
}

const CAMPOS_REVISAVEIS: { rotulo: string; campos: (keyof FiltrosBanco)[] }[] = [
  { rotulo: 'CNAEs principais', campos: ['cnaes'] },
  { rotulo: 'CNAEs secundários', campos: ['cnaesSecundarios'] },
  { rotulo: 'Nome ou palavra-chave', campos: ['palavras'] },
  { rotulo: 'Porte', campos: ['portes'] },
  { rotulo: 'Exclusão de MEI', campos: ['excluirMei', 'meiExclusaoDe', 'meiExclusaoAte'] },
  { rotulo: 'Regime tributário', campos: ['regimes', 'excluirSimples', 'simplesExclusaoDe', 'simplesExclusaoAte'] },
  { rotulo: 'Estabelecimento', campos: ['tipos'] },
  { rotulo: 'Período de abertura', campos: ['aberturaDe', 'aberturaAte', 'aberturaUltimosDias'] },
  { rotulo: 'Contato disponível', campos: ['contato'] },
  { rotulo: 'Capital mínimo', campos: ['capitalMinimo'] },
  { rotulo: 'Capital máximo', campos: ['capitalMaximo'] },
]

function substituicoesDoRascunho(atual: FiltrosBanco, novos: Partial<FiltrosBanco>): string[] {
  return CAMPOS_REVISAVEIS.filter(grupo => grupo.campos.some(campo => {
    const valor = atual[campo]
    const preenchido = Array.isArray(valor) ? valor.length > 0 : Boolean(valor)
    return preenchido && Object.hasOwn(novos, campo) && JSON.stringify(valor) !== JSON.stringify(novos[campo])
  })).map(grupo => grupo.rotulo)
}

type AplicacaoBanco =
  | { ok: true; campos: Partial<FiltrosBanco>; substituicoes: string[] }
  | { ok: false; motivo: string }

const CAPITAL_INTEIRO = /^\d{1,13}$/
const ERRO_CAPITAL = { ok: false, motivo: 'Informe o capital em reais inteiros, sem centavos.' } as const

export function prepararAplicacaoSugestaoBanco(atual: FiltrosBanco, sugestao: SugestaoBanco, selecao: SelecaoPerfilBanco): AplicacaoBanco {
  const campos = camposSugeridosBanco(sugestao)
  const incluidos = new Set(selecao.campos)
  function escolhido<K extends keyof PerfilEmpresaSugerido>(campo: K): PerfilEmpresaSugerido[K] | undefined {
    return incluidos.has(campo) ? sugestao.perfilEmpresa?.[campo] : undefined
  }

  const portes = escolhido('portes')?.valor
  const mei = escolhido('mei')?.valor
  if (mei === 'somente' && portes?.length) return { ok: false, motivo: 'Escolha Somente MEI ou os demais portes.' }
  if (portes) campos.portes = portes
  if (mei) {
    if (mei === 'somente') campos.portes = ['MEI']
    else if (!portes && atual.portes.includes('MEI')) campos.portes = atual.portes.filter(porte => porte !== 'MEI')
    campos.excluirMei = mei === 'excluir'
    if (!campos.excluirMei || !atual.excluirMei) {
      campos.meiExclusaoDe = ''
      campos.meiExclusaoAte = ''
    }
  }

  const regime = escolhido('regime')?.valor
  if (regime) {
    campos.regimes = regime === 'simples' ? ['Simples Nacional'] : []
    campos.excluirSimples = regime === 'fora_simples'
    if (!campos.excluirSimples || !atual.excluirSimples) {
      campos.simplesExclusaoDe = ''
      campos.simplesExclusaoAte = ''
    }
  }
  if ((portes || mei || regime) &&
      (campos.portes ?? atual.portes).includes('MEI') &&
      (campos.excluirSimples ?? atual.excluirSimples)) {
    return { ok: false, motivo: 'Escolha entre Somente MEI e Fora do Simples Nacional.' }
  }

  const estabelecimento = escolhido('estabelecimento')?.valor
  if (estabelecimento) campos.tipos = [estabelecimento === 'matriz' ? '2' : '1']
  const abertura = escolhido('aberturaUltimosDias')?.valor
  if (abertura !== undefined) {
    campos.aberturaUltimosDias = String(abertura)
    campos.aberturaDe = ''
    campos.aberturaAte = ''
  }
  const contato = escolhido('contato')?.valor
  if (contato) campos.contato = contato

  const minimoDigitado = selecao.capitalMinimo?.trim() ?? ''
  const maximoDigitado = selecao.capitalMaximo?.trim() ?? ''
  if (minimoDigitado || maximoDigitado) {
    if ([minimoDigitado, maximoDigitado].some(capital => capital && !CAPITAL_INTEIRO.test(capital))) return ERRO_CAPITAL
    const minimo = minimoDigitado ? String(Number(minimoDigitado)) : atual.capitalMinimo
    const maximo = maximoDigitado ? String(Number(maximoDigitado)) : atual.capitalMaximo
    if ([minimo, maximo].some(capital => !schemaBanco.shape.capitalMinimo.safeParse(capital).success ||
      !Number.isSafeInteger(Number(capital)))) return ERRO_CAPITAL
    if (minimo && maximo && Number(minimo) > Number(maximo)) {
      return { ok: false, motivo: 'O capital mínimo deve ser menor ou igual ao capital máximo do rascunho.' }
    }
    if (minimoDigitado) campos.capitalMinimo = minimo
    if (maximoDigitado) campos.capitalMaximo = maximo
  }

  // A consulta valida todos os filtros ao buscar. Aqui só validamos o que será aplicado ao rascunho.
  if (!lerBanco({ ...bancoInicial(), ...campos }).ok) return { ok: false, motivo: 'Confira os filtros escolhidos para o Banco.' }
  return { ok: true, campos, substituicoes: substituicoesDoRascunho(atual, campos) }
}
