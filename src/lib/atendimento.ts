export const TIPOS_CONTATO = [
  'nao_liguei',
  'nao_atendeu',
  'retornar_depois',
  'sem_interesse',
  'interessado',
  'acompanhamento',
] as const
export type TipoContato = (typeof TIPOS_CONTATO)[number]
export type MotivoAtendimento = 'sem_permissao' | 'nao_encontrada' | 'desatualizada' | 'arquivada' | 'dados_invalidos' | 'chave_reutilizada'
export type ResultadoAtendimento = { ok: true; versao: number; repetida: boolean } | { ok: false; motivo: MotivoAtendimento }
export type ComandoEmpresa = { empresaId: string; chave: string; versao: number }
export type EntradaContato = { tipo: TipoContato; nota: string | null; proximoPasso: string | null; proximoPassoData: string | null }
