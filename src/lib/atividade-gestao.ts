export const PERIODOS_ATIVIDADE = {
  'sete-dias': 'Últimos 7 dias', hoje: 'Hoje', ontem: 'Ontem',
} as const

export const TIPOS_ATIVIDADE = {
  todos: 'Todos os tipos', venda: 'Vendas', contato: 'Atendimentos', funil: 'Sem interesse e retomadas',
  banco: 'Banco de empresas', google: 'Google', falha: 'Falhas de busca',
} as const

export type FiltrosAtividade = {
  vendedorId: string | null
  periodo: keyof typeof PERIODOS_ATIVIDADE
  tipo: keyof typeof TIPOS_ATIVIDADE
  pagina: number
}

export const PAGINA_ATIVIDADE = 20
export const FILTROS_ATIVIDADE: FiltrosAtividade = { vendedorId: null, periodo: 'sete-dias', tipo: 'todos', pagina: 1 }

export type DadosAtividade = {
  nome?: string | null
  regiao?: string | null
  situacao?: string | null
  solicitadas?: number | null
  retornadas?: number | null
  entregues?: number | null
  motivo?: string | null
  nota?: string | null
  proximoPasso?: string | null
  retorno?: string | null
  dataVenda?: string | null
  valorCentavos?: string | null
}

export type EventoAtividade = {
  id: string
  categoria: Exclude<FiltrosAtividade['tipo'], 'todos' | 'falha'>
  vendedorId: string
  vendedor: string
  em: string
  subtipo: string
  empresaId: string | null
  empresa: string | null
  dados: DadosAtividade
}

export type PaginaAtividade = { eventos: EventoAtividade[]; total: number; referencia?: string }

export function filtrosAtividade(valor: unknown): FiltrosAtividade | null {
  if (typeof valor !== 'object' || valor === null) return null
  const { vendedorId, periodo, tipo, pagina } = valor as Partial<FiltrosAtividade>
  if (vendedorId !== null && (typeof vendedorId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(vendedorId))) return null
  if (!periodo || !Object.hasOwn(PERIODOS_ATIVIDADE, periodo) || !tipo || !Object.hasOwn(TIPOS_ATIVIDADE, tipo)) return null
  if (typeof pagina !== 'number' || !Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100_000) return null
  return { vendedorId, periodo, tipo, pagina }
}

const atendimentos: Record<string, { titulo: string; resultado: string }> = {
  interessado: { titulo: 'registrou interesse', resultado: 'Interessado' },
  retornar_depois: { titulo: 'registrou um retorno combinado', resultado: 'Retorno solicitado' },
  nao_liguei: { titulo: 'registrou atividade sem ligação', resultado: 'Não liguei' },
  nao_atendeu: { titulo: 'registrou “Não atendeu”', resultado: 'Não atendeu' },
  acompanhamento: { titulo: 'registrou um acompanhamento', resultado: 'Acompanhamento' },
}

function atendimento(tipo: string) {
  return Object.hasOwn(atendimentos, tipo) ? atendimentos[tipo] : { titulo: 'registrou um atendimento', resultado: 'Atendimento registrado' }
}

export function tituloAtividade({ vendedor, categoria, subtipo, dados }: EventoAtividade) {
  switch (categoria) {
    case 'venda': return `${vendedor} registrou ${subtipo === 'primeira_venda' ? 'a primeira venda' : 'uma recompra'}`
    case 'contato': return `${vendedor} ${atendimento(subtipo).titulo}`
    case 'funil':
      if (subtipo === 'devolver_funil') return `${vendedor} devolveu uma empresa ao Funil`
      if (subtipo === 'retomar') return `${vendedor} retomou um atendimento`
      return `${vendedor} marcou uma empresa como Sem interesse`
    case 'banco':
      if (subtipo === 'falhou') return `A busca do Banco de ${vendedor} falhou`
      if (dados.entregues == null) return `${vendedor} concluiu uma busca no Banco`
      if (dados.entregues === 0) return `A busca de ${vendedor} terminou sem novas empresas`
      return `${vendedor} recebeu ${empresas(dados.entregues)} do Banco`
    case 'google':
      if (subtipo === 'falhou') return `A coleta do Google para ${vendedor} falhou`
      if (dados.entregues == null) return `O Google concluiu a coleta para ${vendedor}`
      if (dados.entregues === 0) return `A coleta do Google para ${vendedor} terminou sem entregas`
      return `Google entregou ${empresas(dados.entregues)} para ${vendedor}`
  }
}

function empresas(total: number) {
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'empresa' : 'empresas'}`
}

function dataCurta(data: string | null | undefined) {
  return data?.split('-').reverse().join('/')
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const paradasGoogle: Record<string, string> = {
  meta_atingida: 'Meta de entregas atingida.', limite_lotes: 'Limite de rodadas atingido.',
  sem_novidades: 'A coleta não encontrou novas empresas.', sem_resultados: 'A coleta não encontrou resultados.',
}

const estadosBusca: Record<string, string> = {
  concluida: 'Concluída', concluido: 'Concluída', falhou: 'Falhou', coletando: 'Coletando',
  validando: 'Validando contatos', cancelado: 'Cancelada',
}

export function descricaoAtividade({ categoria, empresa, dados, subtipo }: EventoAtividade) {
  if (subtipo === 'falhou') return dados.motivo || 'A busca não pôde ser concluída.'
  if (categoria === 'banco' || categoria === 'google') return [dados.nome, dados.regiao].filter(Boolean).join(' · ')
  const passo = dados.proximoPasso && [dados.proximoPasso, dataCurta(dados.retorno)].filter(Boolean).join(' em ')
  return [empresa, subtipo === 'devolver_funil' ? 'Primeiro contato' : passo].filter(Boolean).join(' · ')
}

export function detalhesAtividade({ categoria, subtipo, empresa, dados }: EventoAtividade) {
  const linhas: [string, string | number | null | undefined][] = []
  if (categoria === 'banco' || categoria === 'google') {
    const situacao = dados.situacao || subtipo
    linhas.push([categoria === 'banco' ? 'Busca' : 'Nicho', dados.nome], ['Região', dados.regiao],
      ['Situação', Object.hasOwn(estadosBusca, situacao) ? estadosBusca[situacao] : situacao],
      ['Solicitadas', dados.solicitadas], [categoria === 'banco' ? 'Retornadas pelo fornecedor' : 'Resultados registrados', dados.retornadas])
    if (categoria === 'google' || subtipo !== 'falhou') {
      linhas.push([categoria === 'banco' ? 'Novas empresas na prospecção' : 'Empresas entregues', dados.entregues ?? 'Quantidade não registrada'])
      if (dados.retornadas != null && dados.entregues != null && dados.retornadas >= dados.entregues) {
        linhas.push(['Fora da entrega', dados.retornadas - dados.entregues])
      }
    }
    const motivo = dados.motivo
    linhas.push(['Motivo', categoria === 'google' && motivo && Object.hasOwn(paradasGoogle, motivo) ? paradasGoogle[motivo] : motivo])
  } else {
    linhas.push(['Empresa', empresa])
    if (categoria === 'venda') {
      linhas.push(['Valor', dados.valorCentavos == null ? null : moeda.format(Number(dados.valorCentavos) / 100)],
        ['Data da venda', dataCurta(dados.dataVenda)], ['Observação', dados.nota])
    } else {
      if (categoria === 'contato') linhas.push(['Resultado', atendimento(subtipo).resultado])
      if (subtipo === 'sem_interesse' || subtipo === 'arquivar') linhas.push(['Situação', 'Sem interesse'])
      if (subtipo === 'devolver_funil') linhas.push(['Etapa ao devolver', 'Primeiro contato'])
      if (subtipo === 'retomar') linhas.push(['Ação', 'Retomada na Prospecção'])
      linhas.push(['Próximo passo', dados.proximoPasso], ['Data do retorno', dataCurta(dados.retorno)], ['Nota', dados.nota])
    }
  }
  return linhas.flatMap(([rotulo, valor]) => valor === null || valor === undefined || valor === '' ? [] : [{
    rotulo, valor: typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor,
  }])
}
