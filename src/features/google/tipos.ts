export type PlanoEntrada = { dia: string; nicho: string; bairro: string; cidade: string; uf: string }
export type EstadoGoogle = 'planejado' | 'aguardando' | 'coletando' | 'validando' | 'concluido' | 'falhou' | 'cancelado'
export type PlanoGoogle = PlanoEntrada & { id: string; vendedor_id: string; vendedor: string; estado: EstadoGoogle;
  snapshot: Omit<PlanoEntrada, 'dia'> | null; motivo: string | null; iniciado_em: string | null; concluido_em: string | null;
  encontradas: number; entregues: number; trabalhadas: number; pendentes: number; indisponiveis: number }
export type ResultadoGoogle = { id: string; empresa_id: string | null; situacao: 'entregue' | 'repetida' | 'indisponivel' | 'pendente' | 'conflito';
  dados: Record<string, unknown>; motivo: string | null; entregue_em: string | null; trabalhada: boolean }
export const ESTADOS_GOOGLE: Record<EstadoGoogle, string> = { planejado: 'Planejado', aguardando: 'Na fila do agente',
  coletando: 'Coletando empresas', validando: 'Validando contatos', concluido: 'Concluído', falhou: 'Precisa de conferência', cancelado: 'Não liberado' }
