import type { FiltrosBanco, DetalhesBanco } from '@/src/lib/banco-empresas'
export type FiltrosBusca = {
  avancados?: FiltrosBanco
  palavra: string; cnae: string; uf: string; cidade: string; bairro: string
  porte: '' | 'MEI' | 'ME' | 'EPP' | 'DEMAIS'; tipo: '' | '1' | '2'
  contato: 'telefoneoucelular' | 'telefoneoucelulareemail' | 'email' | 'telefoneoucelularouemail'
  quantidade: number; offset: number
}
export type EmpresaEncontrada = {
  bloqueada_por_repeticao?: boolean
  detalhes?: DetalhesBanco
  cnpj: string; razao_social: string; nome_fantasia: string | null; email: string | null
  telefone: string | null; cep: string | null; cnae_principal: string | null
  situacao: string | null; porte: string | null; data_abertura: string | null
  logradouro: string | null; numero: string | null; complemento: string | null
  bairro: string | null; cidade: string | null; uf: string | null; telefones: string[]
}
export type FalhaFornecedor = 'nao_configurado' | 'credencial_invalida' | 'sem_creditos' | 'fornecedor_ocupado' |
  'fornecedor_indisponivel' | 'tempo_esgotado' | 'resposta_invalida' | 'cnae_nao_encontrado'
export type ResultadoFornecedor = { ok: true; empresas: EmpresaEncontrada[] } | { ok: false; motivo: FalhaFornecedor }
export type ClienteBusca = { validar?(filtros: FiltrosBusca): boolean; buscar(filtros: FiltrosBusca): Promise<ResultadoFornecedor> }
export type BuscaSalva = {
  fornecedor?: 'CNPJ.biz' | 'Casa dos Dados'
  id: string; nome: string; usuario_id: string; vendedor: string; criado_em: string
  filtros: FiltrosBusca; estado: 'reservada' | 'concluida' | 'falhou'
  motivo: FalhaFornecedor | null; empresas: EmpresaEncontrada[]; grupo_id: string | null
}
export type LimiteBusca = { usuario_id: string; vendedor: string; limite_diario: number; pausado: boolean; usado: number }
