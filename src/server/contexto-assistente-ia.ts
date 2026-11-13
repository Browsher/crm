import { z } from 'zod'
import { LIMITE_DESCRICAO_IA, type EntradaAssistente } from '@/src/lib/assistente-ia'
import { obterProdutoProspeccao, perfisDoProduto } from '@/src/lib/assistente-ia-catalogo'
import { perfisBancoParaSugestao } from '@/src/lib/assistente-ia-cnaes-banco'
import { ESTADOS_BR } from '@/src/lib/banco-empresas'

const texto = (maximo: number) => z.string().trim().max(maximo)
const descricao = texto(LIMITE_DESCRICAO_IA).min(1)
const entradaSchema = z.strictObject({
  produto: z.union([z.strictObject({ sku: texto(30).min(1) }), z.strictObject({ descricao })]),
  publico: texto(100).optional(),
  especialidade: texto(100).optional(),
  detalhes: texto(LIMITE_DESCRICAO_IA).optional(),
  regioes: z.array(z.strictObject({
    estado: z.union([z.enum(ESTADOS_BR), z.literal('')]),
    cidade: texto(100),
    bairros: z.array(texto(100).min(1)).max(20),
  })).max(20).optional(),
})

export function prepararContextoAssistente(entrada: EntradaAssistente | string, origem: 'google' | 'banco' = 'google') {
  const validada = entradaSchema.safeParse(typeof entrada === 'string' ? { produto: { descricao: entrada } } : entrada)
  if (!validada.success) return { ok: false, motivo: 'Confira o produto, a região e os detalhes da busca. Use até 600 caracteres em cada campo de texto livre.' } as const

  const { produto, regioes = [], publico, especialidade, detalhes } = validada.data
  const localizacao = regioes.filter(r => r.estado || r.cidade || r.bairros.length)
  if ('descricao' in produto) {
    const textoLivre = produto.descricao
    const contexto = {
      produto: textoLivre,
      ...(publico && { publico }),
      ...(especialidade && { especialidade }),
      ...(detalhes && { detalhes }),
      ...(localizacao.length && { regioes: localizacao }),
    }
    return { ok: true, valor: {
      origem: 'livre',
      mensagem: Object.keys(contexto).length === 1 ? textoLivre : JSON.stringify(contexto),
      textoLivre,
      publico,
      textoPreferencias: [textoLivre, detalhes].filter(Boolean).join('\n'),
      textoSegmento: [textoLivre, publico, especialidade].filter(Boolean).join(' '),
      ...(localizacao.length === 0 && { descricaoRegiao: textoLivre }),
    } } as const
  }

  const ficha = obterProdutoProspeccao(produto.sku)
  if (!ficha) return { ok: false, motivo: 'Escolha um SKU disponível no catálogo.' } as const
  const perfis = origem === 'banco' ? perfisBancoParaSugestao(ficha, publico, especialidade)
    : perfisDoProduto(ficha).filter(perfil => (!publico || perfil.id === publico) &&
      (!especialidade || perfil.especialidades.includes(especialidade)) &&
      (perfil.id !== 'lojas_games' || publico === perfil.id || especialidade === 'Games'))
  if (!perfis.length) return { ok: false, motivo: 'Escolha um público e uma especialidade compatíveis com o produto.' } as const
  return { ok: true, valor: {
    origem: 'catalogo',
    ficha: { sku: ficha.sku, nome: ficha.nome, familia: ficha.familia, ficha: ficha.ficha },
    perfis,
    publico,
    especialidade,
    detalhes,
    regioes: localizacao,
    textoPreferencias: detalhes ?? '',
    descricaoRegiao: undefined,
  } } as const
}

type ContextoCatalogo = Extract<Extract<ReturnType<typeof prepararContextoAssistente>, { ok: true }>['valor'], { origem: 'catalogo' }>

export function mensagemCatalogo(contexto: ContextoCatalogo, perfis: readonly object[]) {
  return JSON.stringify({
    produto: contexto.ficha, perfis, especialidade: contexto.especialidade,
    detalhes: contexto.detalhes, regioes: contexto.regioes,
  })
}
