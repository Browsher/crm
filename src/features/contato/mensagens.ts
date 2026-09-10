import type { Falta } from './regras'
import type { Motivo } from './repositorio'

// Record, não if encadeado: motivo novo sem texto quebra o build.
const TEXTO_DO_MOTIVO: Record<Motivo, string> = {
  sem_permissao: 'Você não tem permissão para isso agora. Se acabou de trocar a senha, entre de novo.',
  nao_encontrada: 'Esta empresa não está mais na fila. Puxe a próxima.',
  reserva_expirada: 'O tempo da reserva acabou e a empresa voltou para a fila. O contato não foi registrado.',
  ja_e_sua: 'Esta empresa já está na sua carteira.',
}

export function textoDoMotivo(m: Motivo): string {
  return TEXTO_DO_MOTIVO[m]
}

const TEXTO_DA_FALTA: Record<Falta, string> = {
  tipo_invalido: 'Escolha o que aconteceu na ligação.',
  desfecho_invalido: 'Escolha o que fazer com a empresa.',
  proximo_passo_exigido: 'Empresa da sua carteira precisa de um próximo passo com data.',
  par_incompleto: 'Próximo passo e data andam juntos: preencha os dois ou nenhum.',
}

export function textoDaFalta(f: Falta): string {
  return TEXTO_DA_FALTA[f]
}
