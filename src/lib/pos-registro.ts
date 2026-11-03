export type DestinoContato = { tipo: 'permanecer' } | { tipo: 'funil'; negociacaoId: string } | { tipo: 'sem_interesse' }
export type DestinoEmpresaAtual = { tipo: 'atendimento'; empresaId: string } | { tipo: 'funil'; negociacaoId: string } | { tipo: 'carteira'; empresaId: string } | { tipo: 'sem_interesse' } | { tipo: 'indisponivel' }
export type LeituraDestino<T> = { ok: true; destino: T } | { ok: false; motivo: 'leitura_indisponivel' }
