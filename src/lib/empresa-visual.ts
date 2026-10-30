import type { DetalhesBanco } from './banco-empresas'
import { formatarCnpj } from './empresa-apresentacao'

export type SituacaoEmpresa = 'a_contatar' | 'atendimento' | 'primeiro_contato' | 'em_negociacao' | 'proposta_enviada' | 'cliente' | 'sem_interesse' | 'indisponivel' | 'arquivada'
export type ReferenciaEmpresa = { tipo: 'cadastro'; empresaId: string } | { tipo: 'busca'; buscaId: string; cnpj: string }
export type ResumoEmpresa = {
  referencia: ReferenciaEmpresa; id: string | null; nome: string; cnpj: string | null; cnae: string | null; atividade: string | null
  bairro: string | null; cidade: string | null; uf: string | null; origens: ('google' | 'banco' | 'legado')[]
  recebidaEm: string | null; situacao: SituacaoEmpresa; versao: number | null; negociacaoId: string | null
  motivoIndisponibilidade?: 'pendente' | 'origem_inativa' | 'responsavel_inativo' | 'outro_responsavel' | 'arquivada' | null
}
export type ResumoEmpresaGestor = ResumoEmpresa & { responsavel: { id: string; nome: string; ativo: boolean } | null }
export type DetalhesEmpresa = ResumoEmpresa & {
  razaoSocial: string | null; nomeFantasia: string | null; telefone: string | null; email: string | null; telefones: string[]
  logradouro: string | null; numero: string | null; complemento: string | null; cep: string | null
  porte: string | null; situacaoCadastral: string | null; dataAbertura: string | null; dadosCadastrais: DetalhesBanco | null
}
export type AcaoEmpresa = { tipo: 'iniciar' | 'retomar'; rotulo: string; empresaId: string; versao: number }
  | { tipo: 'continuar' | 'funil' | 'carteira'; rotulo: string; href: string }
export const SITUACOES_EMPRESA: Record<SituacaoEmpresa, string> = {
  a_contatar: 'A contatar', atendimento: 'Em atendimento', primeiro_contato: 'Primeiro contato', em_negociacao: 'Em negociação', proposta_enviada: 'Proposta enviada', cliente: 'Cliente', sem_interesse: 'Sem interesse', indisponivel: 'Indisponível', arquivada: 'Arquivada',
}
export const MOTIVOS_INDISPONIBILIDADE = { pendente: 'Vínculo pendente de revisão', origem_inativa: 'Origem inativa', responsavel_inativo: 'Responsável inativo', outro_responsavel: 'Com outro vendedor', arquivada: 'Arquivo histórico, somente consulta' }
export function rotuloSituacao(situacao: SituacaoEmpresa) { return SITUACOES_EMPRESA[situacao] }
export function acaoEmpresa(e: ResumoEmpresa): AcaoEmpresa | null {
  if (e.referencia.tipo !== 'cadastro' || !e.id || e.id !== e.referencia.empresaId || !Number.isInteger(e.versao) || e.versao! < 1 || e.situacao === 'indisponivel' || e.situacao === 'arquivada') return null
  if (e.situacao === 'a_contatar' || e.situacao === 'sem_interesse') return { tipo: e.situacao === 'a_contatar' ? 'iniciar' : 'retomar', rotulo: e.situacao === 'a_contatar' ? 'Iniciar atendimento' : 'Retomar atendimento', empresaId: e.id, versao: e.versao! }
  if (e.situacao === 'atendimento') return { tipo: 'continuar', rotulo: 'Continuar atendimento', href: `/fila/atendimento/${encodeURIComponent(e.id)}` }
  if (e.situacao === 'cliente') return { tipo: 'carteira', rotulo: 'Abrir na carteira', href: `/carteira/${encodeURIComponent(e.id)}` }
  return e.negociacaoId ? { tipo: 'funil', rotulo: 'Abrir no funil', href: `/funil?negociacao=${encodeURIComponent(e.negociacaoId)}` } : null
}
export function resumoEmpresa(e: ResumoEmpresa): ResumoEmpresa {
  return { referencia: e.referencia, id: e.id, nome: e.nome, cnpj: e.cnpj, cnae: e.cnae, atividade: e.atividade, bairro: e.bairro, cidade: e.cidade, uf: e.uf, origens: e.origens, recebidaEm: e.recebidaEm, situacao: e.situacao, versao: e.versao, negociacaoId: e.negociacaoId, motivoIndisponibilidade: e.motivoIndisponibilidade }
}
export { formatarCnpj }
export function telefoneEmpresa(telefone: string | null) {
  if (!telefone) return 'Não informado'
  return telefone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')
}
export function dataEmpresa(data: string | null) {
  if (!data) return 'Não informado'
  const d = new Date(data.length === 10 ? data + 'T00:00:00Z' : data)
  return Number.isNaN(d.valueOf()) ? 'Não informado' : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d)
}
// Estrutura de dados persistidos, sem dependência de feature nem identidade global.
export type EmpresaSnapshot = {
  cnpj?: string | null; razao_social?: string | null; nome_fantasia?: string | null; cnae_principal?: string | null
  bairro?: string | null; cidade?: string | null; uf?: string | null; telefone?: string | null; email?: string | null
  logradouro?: string | null; numero?: string | null; complemento?: string | null; cep?: string | null
  porte?: string | null; situacao?: string | null; data_abertura?: string | null; telefones?: string[]; detalhes?: DetalhesBanco
}
export function detalhesSnapshot(e: EmpresaSnapshot, referencia: ReferenciaEmpresa, recebidaEm: string | null = null): DetalhesEmpresa {
  return { referencia, id: null, nome: e.nome_fantasia || e.razao_social || 'Não informado', cnpj: e.cnpj || null, cnae: e.cnae_principal || null, atividade: null, bairro: e.bairro || null, cidade: e.cidade || null, uf: e.uf || null, origens: ['banco'], recebidaEm, situacao: 'indisponivel', versao: null, negociacaoId: null, razaoSocial: e.razao_social || null, nomeFantasia: e.nome_fantasia || null, telefone: e.telefone || null, email: e.email || null, telefones: e.telefones || [], logradouro: e.logradouro || null, numero: e.numero || null, complemento: e.complemento || null, cep: e.cep || null, porte: e.porte || null, situacaoCadastral: e.situacao || null, dataAbertura: e.data_abertura || null, dadosCadastrais: e.detalhes || null }
}
