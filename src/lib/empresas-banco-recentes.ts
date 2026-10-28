import type { EmpresaPessoal } from './prospeccao-pessoal'

export type EmpresaBancoRecente = Omit<EmpresaPessoal, 'cnpj'> & {
  cnpj: string
  buscaId: string
  empresaId: string | null
  atividade: string | null
  endereco: string
  comTelefone: boolean
  comEmail: boolean
}
