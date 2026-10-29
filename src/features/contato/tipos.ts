// Compatibilidade com a UI anterior. O vocabulário comum também atende aos
// comandos diretos da 0052; desfecho permanece apenas nos consumidores legados.
import { TIPOS_CONTATO, type TipoContato } from '../../lib/atendimento'
export { TIPOS_CONTATO, type TipoContato } from '../../lib/atendimento'

export type Desfecho = 'nenhum' | 'assumir' | 'devolver'

export const ROTULO: Record<TipoContato, string> = {
  nao_liguei: 'Não liguei',
  nao_atendeu: 'Liguei, não falei com ninguém',
  retornar_depois: 'Falei, pediu para ligar em outro momento',
  sem_interesse: 'Falei, não tem interesse',
  interessado: 'Falei, tem interesse',
  acompanhamento: 'Falei, e ficou combinado o próximo passo',
}

// Desfecho enviado pela tela; o banco continua sendo a autoridade da posse.
export const DESFECHO_SUGERIDO: Record<TipoContato, Desfecho> = {
  nao_liguei: 'devolver',
  nao_atendeu: 'devolver',
  retornar_depois: 'assumir',
  sem_interesse: 'devolver',
  interessado: 'assumir',
  acompanhamento: 'nenhum',
}

// Onde há posse o próximo passo é exigido; onde não há, não é pedido. Não é
// "esqueci de preencher", é "não existe o que preencher".
export const EXIGE_POSSE: Record<TipoContato, boolean> = {
  nao_liguei: false,
  nao_atendeu: false,
  retornar_depois: false,
  sem_interesse: false,
  interessado: false,
  acompanhamento: true,
}

const CONJUNTO: readonly string[] = TIPOS_CONTATO

export function ehTipo(v: string): v is TipoContato {
  return CONJUNTO.includes(v)
}
