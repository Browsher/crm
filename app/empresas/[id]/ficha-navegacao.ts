import { aplicarFiltrosEmpresas, enderecoEmpresas, lerConsulta } from '@/src/features/empresas/consulta'
import { lerFiltrosEmpresas } from '@/src/features/empresas/filtros'
import { lerRetornoGestor, serializarRetornoGestor, urlRetornoGestor, type OrigemFichaGestor } from '@/src/lib/retorno-gestor'

export type ConsultaFicha = Record<string, string | string[] | undefined>

export function navegacaoFicha(arquivada: boolean, query: ConsultaFicha) {
  const filtros = lerFiltrosEmpresas(query)
  const retorno = lerRetornoGestor(query.retorno)
  const origem = retorno?.tipo === 'empresas' || retorno?.tipo === 'arquivo' || retorno?.tipo === 'grupo' || retorno?.tipo === 'coleta' || retorno?.tipo === 'whatsapp' ? retorno : undefined
  const consulta = lerConsulta(query)
  const destinoPadrao = arquivada ? '/empresas/arquivadas' : filtros.ok ? enderecoEmpresas(aplicarFiltrosEmpresas(consulta, filtros.filtros)) : '/empresas'
  const voltar = origem ? urlRetornoGestor(origem) : destinoPadrao
  const rotuloVolta = origem?.tipo === 'grupo' ? 'Voltar para a lista' : origem?.tipo === 'coleta' ? 'Voltar para a coleta'
    : origem?.tipo === 'whatsapp' ? 'Voltar ao WhatsApp'
      : origem?.tipo === 'arquivo' || (!origem && arquivada) ? 'Voltar ao arquivo' : 'Voltar para empresas'
  const origemPadrao: OrigemFichaGestor | undefined = arquivada ? { tipo: 'arquivo', q: '', pagina: 1, gruposPagina: 1 }
    : filtros.ok ? {
      tipo: 'empresas', q: consulta.termo, pagina: consulta.pagina, cnae: filtros.filtros.cnae ?? undefined,
      uf: filtros.filtros.uf ?? undefined, cidade: filtros.filtros.cidade ?? undefined, bairro: filtros.filtros.bairro ?? undefined,
    } : undefined
  const origemHistorico = origem ?? (origemPadrao && serializarRetornoGestor(origemPadrao) ? origemPadrao : undefined)
  const abaInicial = query.aba === 'historico' ? 'historico' as const : 'dados' as const
  return { origem, voltar, rotuloVolta, origemHistorico, abaInicial }
}
