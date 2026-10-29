export type FonteMaps = Record<string, string> & {
  place_id: string
  nome_empresa: string
  cnpj: string
  telefone: string
  endereco: string
  link_maps: string
}
export type EstadoWhatsApp = 'pendente' | 'encontrado' | 'nao_encontrado' | 'inconclusivo'
export type EmpresaBase = {
  id: string
  placeIds: string[]
  cnpj: string | null
  publicados: FonteMaps
  telefoneNormalizado: string | null
  coletas: string[]
  revisao: 'pendente' | 'revisada' | 'telefone_compartilhado'
  observacoes: string
}
export type TelefoneBase = {
  numero: string
  tipo: 'fixo' | 'celular'
  empresas: string[]
  estado: EstadoWhatsApp
  numeroRetornado: string | null
  jid: string | null
  verificadoEm: string | null
  statusHTTP: number | null
  motivo: string | null
  revalidar: boolean
}
export type ColetaEntrada = {
  id: string
  execucaoId: string
  fonte: string
  regiao: string
  termos: string[]
  data: string
  arquivo: string
  sha256: string
}
export type Ocorrencia = {
  chave: string
  coleta: ColetaEntrada
  tipo: 'resumo' | 'ocorrencia'
  linha: number | null
  empresaId: string | null
  fonteOriginal: FonteMaps | null
  motivos: string[]
  contagens: Record<string, number>
}
export type Base = { empresas: EmpresaBase[]; telefones: TelefoneBase[]; coletas: Ocorrencia[] }
export type PendenciaBase = { linha: number; motivo: string }
export type Consolidacao =
  | { ok: true; base: Base; pendencias: PendenciaBase[] }
  | { ok: false; motivo: 'base_duplicada' | 'entrada_invalida'; detalhes: string[] }
export type LinhaAba = Record<string, string>
