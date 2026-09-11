export type Filtros = {
  nome: string
  cnae: string | null
  uf: string | null
  cidade: string | null
  bairro: string | null
  pagina: number
}

export type Disponibilidade =
  | 'disponivel'
  | 'comigo'
  | 'reservada_comigo'
  | 'outro_vendedor'
  | 'em_descanso'

export type ResumoEmpresa = {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnaePrincipal: string | null
  cidade: string | null
  uf: string | null
  bairro: string | null
  disponibilidade: Disponibilidade
}

export type ResultadoConsulta =
  | { ok: true; empresas: ResumoEmpresa[]; temProxima: boolean }
  | { ok: false; motivo: 'sem_permissao' }

export type OpcoesFiltro = {
  tipo: 'cnae' | 'uf' | 'cidade' | 'bairro'
  valor: string
  rotulo: string
}

export type ResultadoOpcoes =
  | { ok: true; opcoes: OpcoesFiltro[] }
  | { ok: false; motivo: 'sem_permissao' }
