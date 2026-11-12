import { z } from 'zod'
import type { CnaeConfirmado, SugestaoBanco } from '@/src/lib/assistente-ia-banco'
import type { ResultadoAssistente } from '@/src/lib/assistente-ia'
import { camposPublico, esquemaSugestoes, normalizarTexto, sugerirPublicos, textoCurto } from '@/src/server/assistente-ia'

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
const CNAE_IBGE = 'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/'
const registro = z.object({ id: codigoCnae, descricao: textoCurto(500) })
const catalogo = z.union([z.array(registro), registro])

async function consultarCnaes(codigos: string[]): Promise<Map<string, string>> {
  if (!codigos.length) return new Map()
  try {
    const resposta = await fetch(CNAE_IBGE + encodeURIComponent(codigos.sort().join('|')), {
      next: { revalidate: 86_400 }, signal: AbortSignal.timeout(4_000),
    })
    if (!resposta.ok) return new Map()
    const dados = catalogo.safeParse(await resposta.json())
    if (!dados.success) return new Map()
    const registros = Array.isArray(dados.data) ? dados.data : [dados.data]
    return new Map(registros.map(({ id, descricao }) => [id, descricao]))
  } catch {
    return new Map()
  }
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
  const codigos = new Set(candidatas.flatMap(s => [...(s.cnaes ?? []), ...(s.cnaesSecundarios ?? [])]))
  const descricoes = await consultarCnaes([...codigos])
  const confirmados = (lista: string[] = []): CnaeConfirmado[] => [...new Set(lista)].flatMap(codigo => {
    const descricao = descricoes.get(codigo)
    return descricao ? [{ codigo, descricao }] : []
  })
  const assinaturas = new Set<string>()
  const sugestoes = candidatas.map(s => ({
    ...s,
    cnaes: confirmados(s.cnaes),
    cnaesSecundarios: confirmados(s.cnaesSecundarios?.filter(codigo => !s.cnaes?.includes(codigo))),
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

  if (!sugestoes.length) return { ok: false, motivo: codigos.size
    ? 'Não foi possível confirmar um CNAE no IBGE. Você pode revisar a descrição ou preencher os filtros manualmente.'
    : 'Nenhum filtro aplicável encontrado. Descreva o produto ou o público que você quer prospectar.' }
  return { ok: true, valor: { ...resultado.valor, sugestoes } }
}
