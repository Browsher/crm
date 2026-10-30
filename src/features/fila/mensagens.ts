import type { Falha } from './repositorio'

// As consultas pessoais ainda compartilham esta recusa de autorização.
const TEXTO_DO_MOTIVO: Record<Falha['motivo'], string> = {
  sem_permissao: 'Você não tem permissão para isso agora. Se acabou de trocar a senha, entre de novo.',
}

export function textoDoMotivo(m: Falha['motivo']): string {
  return TEXTO_DO_MOTIVO[m]
}
