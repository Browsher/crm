export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: string }
export type VerificacaoGoogle = 'dados_google' | 'presenca_digital' | 'perfil_comercial' | 'whatsapp' | 'fixo'
export type CriteriosGoogle = {
  termos: string
  produtos: string
  tipos: ('varejista' | 'atacadista' | 'distribuidor' | 'fabricante')[]
  atendimento: '' | 'priorizar_fisica' | 'fisica' | 'online' | 'ambos'
  excluir: string
  situacao: '' | 'priorizar_funcionamento' | 'funcionamento' | 'excluir_encerradas' | 'excluir_fechadas'
  site: ('com' | 'sem')[]
  email: ('com' | 'sem')[]
  telefone: ('whatsapp' | 'fixo')[]
  nota: number | null
  avaliacoes: number | null
  prioridades: string
  observacoes: string
}

export function criteriosVazios(): CriteriosGoogle {
  return { termos: '', produtos: '', tipos: [], atendimento: '', excluir: '', situacao: '', site: [], email: [], telefone: [], nota: null, avaliacoes: null, prioridades: '', observacoes: '' }
}

const TEXTOS = ['termos', 'produtos', 'excluir', 'prioridades', 'observacoes'] as const
const LISTAS = {
  tipos: ['varejista', 'atacadista', 'distribuidor', 'fabricante'],
  site: ['com', 'sem'], email: ['com', 'sem'], telefone: ['whatsapp', 'fixo'],
} as const
const ESCOLHAS = {
  atendimento: ['', 'priorizar_fisica', 'fisica', 'online', 'ambos'],
  situacao: ['', 'priorizar_funcionamento', 'funcionamento', 'excluir_encerradas', 'excluir_fechadas'],
} as const
const INVALIDO = { ok: false, motivo: 'Confira os critérios de busca. Use as opções disponíveis e até 2.000 caracteres por campo.' } as const

export function normalizarCriterios(entrada: unknown): Resultado<CriteriosGoogle> {
  if (entrada === undefined || entrada === null) return { ok: true, valor: criteriosVazios() }
  if (typeof entrada === 'string') entrada = { observacoes: entrada }
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return INVALIDO
  const dados = entrada as Record<string, unknown>
  const valor = criteriosVazios()
  if (Object.keys(dados).some(k => !Object.hasOwn(valor, k))) return INVALIDO
  for (const k of TEXTOS) {
    const texto = dados[k] === undefined ? '' : dados[k]
    if (typeof texto !== 'string' || Array.from(texto).length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(texto)) return INVALIDO
    valor[k] = texto.replace(/\r\n?/g, '\n').trim()
  }
  for (const k of Object.keys(LISTAS) as (keyof typeof LISTAS)[]) {
    const lista = dados[k] === undefined ? [] : dados[k]
    const opcoes: readonly string[] = LISTAS[k]
    if (!Array.isArray(lista) || lista.length > 100 || lista.some(v => typeof v !== 'string' || !opcoes.includes(v))) return INVALIDO
    const selecionadas = opcoes.filter(v => lista.includes(v))
    Object.assign(valor, { [k]: (k === 'site' || k === 'email') && selecionadas.length === 2 ? [] : selecionadas })
  }
  for (const k of Object.keys(ESCOLHAS) as (keyof typeof ESCOLHAS)[]) {
    const escolha = dados[k] === undefined ? '' : dados[k]
    const opcoes: readonly string[] = ESCOLHAS[k]
    if (typeof escolha !== 'string' || !opcoes.includes(escolha)) return INVALIDO
    Object.assign(valor, { [k]: escolha })
  }
  for (const k of ['nota', 'avaliacoes'] as const) {
    const numero = dados[k] ?? null
    if (numero !== null && (typeof numero !== 'number' || !Number.isFinite(numero) || numero < 0 || (k === 'nota' ? numero > 5 : !Number.isSafeInteger(numero)))) return INVALIDO
    valor[k] = numero as number | null
  }
  return { ok: true, valor }
}

export function verificacoesNecessarias(c: CriteriosGoogle): VerificacaoGoogle[] {
  const etapas: VerificacaoGoogle[] = []
  if (c.nota !== null || c.avaliacoes !== null || (c.situacao && c.situacao !== 'priorizar_funcionamento')) etapas.push('dados_google')
  if (c.site.length === 1 || c.email.length === 1) etapas.push('presenca_digital')
  if (c.produtos || c.tipos.length || c.excluir || c.observacoes || (c.atendimento && c.atendimento !== 'priorizar_fisica')) etapas.push('perfil_comercial')
  if (c.telefone.includes('whatsapp')) etapas.push('whatsapp')
  if (c.telefone.includes('fixo')) etapas.push('fixo')
  return etapas
}
