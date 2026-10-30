import type { Endereco } from '../server/cep/resolver'
import type { ResumoEmpresa, SituacaoEmpresa } from './empresa-visual'

export type EmpresaComigo = {
  id: string
  cnpj: string | null
  razaoSocial: string | null
  nomeFantasia: string | null
  cnaePrincipal: string | null
  ultimoContato: { nota: string | null; criadoEm: Date } | null
  contatoNome: string | null
  telefone: string | null
  email: string | null
  cep: string | null
  endereco: Endereco | null
  // Compatibilidade com leitores antigos. No atendimento permanente é nulo.
  reservadoAte: Date | null
  posse: boolean
  // Somente agenda_contato_id representa a tarefa vigente, separada do histórico.
  proximoPasso: string | null
  proximoPassoData: string | null
  situacaoRetorno: 'atrasado' | 'hoje' | 'futuro' | 'sem_data'
  vencido: boolean
  situacao: SituacaoEmpresa
  versao: number
  empresa?: ResumoEmpresa
}
