import type { EtapaFunil } from './comercial'

export type SituacaoEmpresaWhatsApp = EtapaFunil | 'carteira' | 'reservada' | 'inativa' | 'descanso' | 'disponivel'
const rotulos: Record<SituacaoEmpresaWhatsApp, string> = {
  primeiro_contato: 'Primeiro contato', em_negociacao: 'Em negociação', proposta_enviada: 'Proposta enviada',
  carteira: 'Em carteira', reservada: 'Reservada', inativa: 'Sem grupo ativo', descanso: 'Em descanso', disponivel: 'Disponível para prospecção',
}

export type CadastroWhatsApp = {
  telefone: string
} & ({ estado: 'encontrada'; empresa: { id: string; nome: string; situacao?: SituacaoEmpresaWhatsApp } } | { estado: 'ausente' | 'ambigua' | 'indisponivel' })

export const rotuloCadastro = (cadastro?: CadastroWhatsApp) => {
  if (!cadastro) return 'Empresa não identificada'
  if (cadastro.estado === 'encontrada') return cadastro.empresa.situacao ? rotulos[cadastro.empresa.situacao] : 'Cadastrada'
  if (cadastro.estado === 'ausente') return 'Não cadastrada'
  if (cadastro.estado === 'ambigua') return 'Telefone em várias empresas'
  return 'Consulta de empresa indisponível'
}
