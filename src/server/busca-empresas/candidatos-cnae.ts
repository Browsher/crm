import type { CnaeConfirmado } from '@/src/lib/assistente-ia-banco'
import { normalizarTexto } from '@/src/server/assistente-ia'
import catalogoIbge from './cnae-ibge.json'

const descricoes: Readonly<Partial<Record<string, string>>> = catalogoIbge
const GENERICAS = new Set(`
  acessorio atividade aparelho artigo atacadista atacado bairro brasileiro comprador comercial comercio
  codigo cidade consulta distribuidor empresa equipamento estado filtro industria industrial loja maquina
  mercado nacional negocio principal procurar produto quero regioes regiao revenda secundario cultivo
  segmento servico varejo varejista vender venda uso outro coisa nome fantasia palavra razao social
  publico tipo pequeno pessoal domestico geral relacionado inclua incluir que para pelo com
  uma uns em sao paulo bras shopping comprar prospectar setor nao especificado anterior
  anteriormente sei ajuda pode podem favor gostaria gostaria qualquer apenas somente
`.trim().split(/\s+/))

function termos(texto: string) {
  return new Set(normalizarTexto(texto).split(' ')
    .map(termo => termo.length > 4 ? termo.replace(/s$/, '') : termo)
    .filter(termo => termo.length >= 3 && !GENERICAS.has(termo)))
}

const linhas = Object.entries(catalogoIbge).map(([codigo, descricao]) => ({
  codigo, palavras: termos(descricao), atividade: normalizarTexto(descricao),
}))

function textoPositivo(texto: string): string {
  return texto.split(/[.!?;\n]+/).map(frase =>
    normalizarTexto(frase).split(/\b(?:exclu\w*|evit\w*|exceto|menos|nao (?:quero|inclu\w*|us\w*|consider\w*))\b/, 1)[0],
  ).join(' ')
}

function atividadeDoPublico(texto: string) {
  const alvo = textoPositivo(texto)
  const atividades = [
    [/\b(?:lojas?|lojistas?|varej\w*|pet shops?|armarinhos?)\b/, /\bvarej\w*\b/],
    [/\b(?:distribu\w*|atacad\w*)\b/, /\batacad\w*\b/],
    [/\b(?:instalador\w*|instalacao|monitoramento)\b/, /\b(?:instalacao|monitoramento)\b/],
    [/\b(?:fabricantes?|fabricacao|industrias?)\b/, /\bfabricacao\b/],
  ].filter(([papel]) => papel.test(alvo)).map(([, atividade]) => atividade)
  return (atividade: string) => !atividades.length || atividades.some(filtro => filtro.test(atividade))
}

export function cnaeOficial(codigo: string, criterio?: { motivo: string; amplo?: boolean }): CnaeConfirmado[] {
  const descricao = descricoes[codigo]
  return descricao ? [{ codigo, descricao, ...(criterio && { motivo: criterio.motivo, ...(criterio.amplo && { amplo: true }) }) }] : []
}

export function candidatosCnaeLivre(texto: string, publico = ''): CnaeConfirmado[] {
  const positivo = textoPositivo(texto)
  const tokens = termos(positivo)
  if (/\broupas?\b/.test(positivo)) tokens.add('vestuario')
  const aceitar = atividadeDoPublico(publico)
  const afinidades = [
    ...(/\b(?:led|leds|iluminacao|luminarias?)\b/.test(positivo) ? ['4754703', '4649406', '4321500'] : []),
    ...(/\b(?:pet shops?|acessorios? pet|animais de estimacao|racao para (?:caes|gatos))\b/.test(positivo) ? ['4789004'] : []),
  ]
  const explicitados = [...positivo.matchAll(/\bcnaes?\s+(\d{4})\s?(\d)\s?(\d{2})\b/g)]
    .map(([, classe, digito, subclasse]) => classe + digito + subclasse)
  const proximos = linhas.flatMap(({ codigo, palavras, atividade }) => {
    if (!aceitar(atividade)) return []
    const pontos = [...tokens].filter(token => palavras.has(token)).length
    return pontos > 0 ? [{ codigo, pontos }] : []
  }).sort((a, b) => b.pontos - a.pontos).map(c => c.codigo)
  const relacionadas = [...explicitados, ...afinidades].filter(codigo => descricoes[codigo] && aceitar(normalizarTexto(descricoes[codigo])))
  const candidatas = [...new Set([...relacionadas, ...proximos])]
  return candidatas.slice(0, 18).flatMap(codigo => cnaeOficial(codigo, {
    motivo: 'Atividade relacionada aos termos informados.',
    amplo: codigo.endsWith('99'),
  }))
}
