import { z } from 'zod'
import type { CnaeConfirmado, SugestaoBanco } from '@/src/lib/assistente-ia-banco'
import type { ResultadoAssistente } from '@/src/lib/assistente-ia'
import { camposPublico, esquemaSugestoes, normalizarTexto, sugerirPublicos, textoCurto } from '@/src/server/assistente-ia'
import catalogoIbge from './cnae-ibge.json'

const codigoCnae = z.string().refine(codigo => /^[0-9]{7}$/.test(codigo))
const codigosCnae = z.array(codigoCnae).refine(codigos => codigos.length <= 3)
const schema = esquemaSugestoes(z.strictObject({
  ...camposPublico,
  cnaes: codigosCnae.optional(),
  cnaesSecundarios: codigosCnae.optional(),
  palavras: z.array(textoCurto(100)).refine(palavras => palavras.length <= 3 && palavras.every(palavra => !palavra.includes(','))).optional(),
}))

const INSTRUCOES = [
  'Ajude um vendedor a prospectar empresas no Banco de empresas brasileiro.',
  'Sugira até três CNAEs principais de sete dígitos por público, com o código exato da subclasse e zeros iniciais. Omita códigos incertos.',
  'Use cnaesSecundarios somente quando o vendedor pedir atividades secundárias. Não duplique códigos entre os dois campos.',
  'Palavras são restrições à razão social ou ao nome fantasia, não à descrição do segmento. Use até três palavras somente quando o vendedor pedir filtro no nome da empresa.',
  'Um público precisa ter ao menos um CNAE ou uma palavra-chave de nome utilizável. Use apenas os filtros relevantes.',
]
const descricoesCnae: Readonly<Partial<Record<string, string>>> = catalogoIbge

function confirmarCnaes(lista: string[] = []): CnaeConfirmado[] {
  return [...new Set(lista)].flatMap(codigo => {
    const descricao = descricoesCnae[codigo]
    return descricao ? [{ codigo, descricao }] : []
  })
}

export async function sugerirFiltrosBanco(descricao: string): Promise<ResultadoAssistente<SugestaoBanco>> {
  const resultado = await sugerirPublicos('banco', descricao, schema, INSTRUCOES, publico => publico.titulo)
  if (!resultado.ok) return resultado
  const texto = ' ' + normalizarTexto(descricao) + ' '
  const pediuSecundarios = /\bsecundari[ao]s?\b/.test(texto)
  const pediuNomes = /\b(?:no nome|pelo nome|nome fantasia|nome da empresa|razao social|palavra chave)\b/.test(texto)
  const candidatas = resultado.valor.sugestoes.map(s => ({
    ...s,
    cnaesSecundarios: pediuSecundarios ? s.cnaesSecundarios : undefined,
    palavras: pediuNomes ? s.palavras?.filter(palavra => {
      const termo = normalizarTexto(palavra)
      return Boolean(termo) && texto.includes(' ' + termo + ' ')
    }) : undefined,
  }))
  const temCnaes = candidatas.some(s => s.cnaes?.length || s.cnaesSecundarios?.length)
  const assinaturas = new Set<string>()
  const sugestoes = candidatas.map(s => ({
    ...s,
    cnaes: confirmarCnaes(s.cnaes),
    cnaesSecundarios: confirmarCnaes(s.cnaesSecundarios?.filter(codigo => !s.cnaes?.includes(codigo))),
    palavras: [...new Set(s.palavras)],
  })).filter(s => {
    if (!s.palavras.length && !s.cnaes.length && !s.cnaesSecundarios.length) return false
    const assinatura = JSON.stringify([
      s.cnaes.map(c => c.codigo).sort(),
      s.cnaesSecundarios.map(c => c.codigo).sort(),
      [...new Set(s.palavras.map(normalizarTexto))].sort(),
    ])
    if (assinaturas.has(assinatura)) return false
    assinaturas.add(assinatura)
    return true
  })

  if (!sugestoes.length) return { ok: false, motivo: temCnaes
    ? 'Nenhum CNAE sugerido consta no catálogo oficial. Você pode revisar a descrição ou preencher os filtros manualmente.'
    : 'Nenhum filtro aplicável encontrado. Descreva o produto ou o público que você quer prospectar.' }
  return { ok: true, valor: { ...resultado.valor, sugestoes } }
}
