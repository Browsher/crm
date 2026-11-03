import { z } from 'zod'
import { MAX_TERMO } from '@/src/features/empresas/consulta'
import { lerFiltrosEmpresas } from '@/src/features/empresas/filtros'
import { semanaDe } from '@/src/features/google/regras'
import { ESTADOS_GOOGLE, type EstadoGoogle } from '@/src/features/google/tipos'

const CONTROLE = /\p{Cc}/u
const MAX_RETORNO = 2048
const id = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const pagina = z.number().int().min(1).max(1_000_000)
const texto = (max: number) => z.string().max(max).refine(valor => !CONTROLE.test(valor) && valor.isWellFormed())
const empresas = z.strictObject({
  tipo: z.literal('empresas'), q: texto(MAX_TERMO), pagina,
  cnae: texto(13).optional(), uf: texto(2).optional(), cidade: texto(7).optional(), bairro: texto(200).optional(),
}).refine(({ cnae, uf, cidade, bairro }) => lerFiltrosEmpresas({ cnae, uf, cidade, bairro }).ok)
const arquivo = z.strictObject({ tipo: z.literal('arquivo'), q: texto(MAX_TERMO), pagina, gruposPagina: pagina })
const grupo = z.strictObject({ tipo: z.literal('grupo'), id, pagina, gruposPagina: pagina, arquivo: arquivo.optional() })
const google = z.strictObject({
  tipo: z.literal('google'),
  semana: z.string().refine(data => semanaDe(data) !== null),
  vendedor: id.optional(),
  estado: z.custom<EstadoGoogle>(estado => typeof estado === 'string' && Object.hasOwn(ESTADOS_GOOGLE, estado)).optional(),
})
export const MAX_BUSCA_WHATSAPP = 100
const fonteWhatsApp = z.union([id, z.literal('piloto')])
const whatsapp = z.strictObject({
  tipo: z.literal('whatsapp'),
  vendedor: z.union([fonteWhatsApp, z.literal('todos')]),
  busca: texto(MAX_BUSCA_WHATSAPP),
  categoria: z.enum(['todas', 'pendentes', 'ausentes']),
  painel: z.enum(['lista', 'conversa']),
  conversa: z.strictObject({
    fonteId: fonteWhatsApp,
    id: texto(256).refine(valor => valor.trim().length > 0),
  }).optional(),
}).refine(({ painel, conversa, vendedor }) =>
  conversa ? vendedor === 'todos' || vendedor === conversa.fonteId : painel === 'lista',
)
const camposColeta = { tipo: z.literal('coleta'), id, pagina: pagina.max(100) }
const camposFicha = { tipo: z.literal('ficha'), id, aba: z.literal('historico') }
const coletaDePlanejamento = z.strictObject({ ...camposColeta, origem: google.optional() })
const origensFicha = [empresas, arquivo, grupo, whatsapp] as const
const fichaHistoricoBase = z.strictObject({
  ...camposFicha, origem: z.discriminatedUnion('tipo', [...origensFicha, coletaDePlanejamento]).optional(),
})
const coleta = z.strictObject({
  ...camposColeta, origem: z.discriminatedUnion('tipo', [google, fichaHistoricoBase]).optional(),
})
const origemFicha = z.discriminatedUnion('tipo', [...origensFicha, coleta])
const ficha = z.strictObject({ ...camposFicha, origem: origemFicha.optional() })
const contexto = z.discriminatedUnion('tipo', [...origensFicha, google, coleta, ficha])

export type ContextoRetornoGestor = z.infer<typeof contexto>
export type RetornoWhatsApp = z.infer<typeof whatsapp>
export type OrigemFichaGestor = z.infer<typeof origemFicha>
export type OrigemDetalheGoogleGestor = z.infer<typeof google> | z.infer<typeof ficha>

export function lerRetornoGestor(entrada: string | string[] | undefined): ContextoRetornoGestor | null {
  if (typeof entrada !== 'string' || entrada.length > MAX_RETORNO || CONTROLE.test(entrada)) return null
  try {
    const resultado = contexto.safeParse(JSON.parse(entrada))
    // A representação canônica também recusa chaves JSON duplicadas, que
    // JSON.parse sozinho aceitaria tomando somente a última ocorrência.
    return resultado.success && JSON.stringify(resultado.data) === entrada ? resultado.data : null
  } catch {
    return null
  }
}

export function serializarRetornoGestor(retorno: ContextoRetornoGestor): string {
  const resultado = contexto.safeParse(retorno)
  if (!resultado.success) return ''
  const serializado = JSON.stringify(resultado.data)
  return serializado.length <= MAX_RETORNO ? serializado : ''
}

function adicionarRetornoGestor(parametros: URLSearchParams, retorno: ContextoRetornoGestor | undefined) {
  if (!retorno) return
  const serializado = serializarRetornoGestor(retorno)
  if (serializado) parametros.set('retorno', serializado)
}

export function urlFichaGestor(id: string, origem?: OrigemFichaGestor, aba?: 'historico'): string {
  const params = new URLSearchParams()
  if (aba) params.set('aba', aba)
  adicionarRetornoGestor(params, origem)
  const caminho = '/empresas/' + encodeURIComponent(id)
  return params.size ? caminho + '?' + params : caminho
}

export function urlColetaGestor(id: string, pagina = 1, origem?: OrigemDetalheGoogleGestor): string {
  const params = new URLSearchParams()
  if (pagina > 1) params.set('pagina', String(pagina))
  adicionarRetornoGestor(params, origem)
  const caminho = '/empresas/google/' + encodeURIComponent(id)
  return params.size ? caminho + '?' + params : caminho
}

// Preserva Histórico → coleta → ficha → coleta. Em voltas sucessivas entre
// históricos, mantém a coleta anterior e sua página, encerrando a cadeia ali.
export function retornoColetaGestor(id: string, pagina: number, origem?: OrigemDetalheGoogleGestor): z.infer<typeof coleta> {
  if (origem?.tipo === 'ficha') {
    const anterior = origem.origem
    if (anterior?.tipo === 'coleta') {
      const planejamento = anterior.origem?.tipo === 'google' ? anterior.origem : undefined
      return { tipo: 'coleta', id, pagina, origem: { ...origem, origem: { ...anterior, origem: planejamento } } }
    }
    return { tipo: 'coleta', id, pagina, origem: { ...origem, origem: anterior } }
  }
  return { tipo: 'coleta', id, pagina, origem }
}

export function urlConfiguracaoWhatsApp(retorno?: RetornoWhatsApp): string {
  const params = new URLSearchParams()
  adicionarRetornoGestor(params, retorno)
  return '/whatsapp/configuracao' + (params.size ? '?' + params : '')
}

export function urlRetornoGestor(retorno: ContextoRetornoGestor): string {
  const params = new URLSearchParams()
  let caminho: string
  switch (retorno.tipo) {
    case 'empresas':
      caminho = '/empresas'
      if (retorno.q) params.set('q', retorno.q)
      for (const chave of ['cnae', 'uf', 'cidade', 'bairro'] as const) {
        const valor = retorno[chave]
        if (valor) params.set(chave, valor)
      }
      params.set('pagina', String(retorno.pagina))
      break
    case 'arquivo':
      caminho = '/empresas/arquivadas'
      if (retorno.q) params.set('q', retorno.q)
      if (retorno.pagina > 1) params.set('pagina', String(retorno.pagina))
      if (retorno.gruposPagina > 1) params.set('gruposPagina', String(retorno.gruposPagina))
      break
    case 'grupo':
      caminho = '/empresas/grupos/' + encodeURIComponent(retorno.id)
      if (retorno.pagina > 1) params.set('pagina', String(retorno.pagina))
      if (retorno.arquivo) adicionarRetornoGestor(params, retorno.arquivo)
      else params.set('gruposPagina', String(retorno.gruposPagina))
      break
    case 'google':
      caminho = '/empresas/google'
      params.set('semana', retorno.semana)
      if (retorno.vendedor) params.set('vendedor', retorno.vendedor)
      if (retorno.estado) params.set('estado', retorno.estado)
      break
    case 'whatsapp':
      caminho = '/whatsapp'
      adicionarRetornoGestor(params, retorno)
      break
    case 'coleta':
      return urlColetaGestor(retorno.id, retorno.pagina, retorno.origem)
    case 'ficha':
      return urlFichaGestor(retorno.id, retorno.origem, retorno.aba)
  }
  return params.size ? caminho + '?' + params : caminho
}
