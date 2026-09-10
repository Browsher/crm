// Lista fechada aqui, e no banco só o piso de não-vazio. `usuario.papel` está
// no CHECK porque o BANCO o lê (eh_gestor); `contato.tipo` nenhuma função lê,
// então cada palavra nova aqui é uma linha de código, não uma migração.
// O preço: o banco aceita qualquer texto. A defesa é `ehTipo` e os testes.
export const TIPOS_CONTATO = [
  'nao_liguei',
  'nao_atendeu',
  'retornar_depois',
  'sem_interesse',
  'interessado',
  'acompanhamento',
] as const

export type TipoContato = (typeof TIPOS_CONTATO)[number]

export type Desfecho = 'nenhum' | 'assumir' | 'devolver'

export const ROTULO: Record<TipoContato, string> = {
  nao_liguei: 'Não liguei — descartei pelo cadastro',
  nao_atendeu: 'Liguei, não falei com ninguém',
  retornar_depois: 'Falei, pediu para ligar em outro momento',
  sem_interesse: 'Falei, não tem interesse',
  interessado: 'Falei, tem interesse',
  acompanhamento: 'Falei, e ficou combinado o próximo passo',
}

// Sugestão da TELA, não regra do banco. É a coerência desta escolha que
// mantém verdadeiro o desenho de o banco não interpretar `tipo`.
export const DESFECHO_SUGERIDO: Record<TipoContato, Desfecho> = {
  nao_liguei: 'devolver',
  nao_atendeu: 'devolver',
  retornar_depois: 'devolver',
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
