import type { Motivo } from './repositorio'

// Record, não if encadeado: motivo novo sem texto quebra o build.
const TEXTO_DO_MOTIVO: Record<Motivo, string> = {
  sem_permissao: 'Você não tem permissão para isso agora. Se acabou de trocar a senha, entre de novo.',
  nao_encontrada: 'Esta empresa não está mais na fila. Puxe a próxima.',
  reserva_expirada: 'O tempo da reserva acabou e a empresa voltou para a fila. Puxe a próxima.',
  ja_e_sua: 'Esta empresa já está na sua carteira.',
}

export function textoDoMotivo(m: Motivo): string {
  return TEXTO_DO_MOTIVO[m]
}
