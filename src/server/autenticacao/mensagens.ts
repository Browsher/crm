import type { ResultadoEntrar } from './entrar'
import type { Falta } from './senha'
import type { ResultadoTrocar } from './trocar-senha'

export function mensagemDeLogin(r: Extract<ResultadoEntrar, { ok: false }>): string {
  if (r.motivo === 'credenciais_invalidas') return 'E-mail ou senha não conferem.'
  const minutos = Math.max(1, Math.ceil(r.segundosRestantes / 60))
  return `Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`
}

const TEXTO_DA_FALTA: Record<Falta, string> = {
  minimo: 'ter pelo menos 8 caracteres',
  maximo: 'ter no máximo 128 caracteres',
  so_espaco: 'ter algum caractere que não seja espaço',
  igual_atual: 'ser diferente da atual',
}

export function mensagemDeTroca(r: Extract<ResultadoTrocar, { ok: false }>): string {
  if (r.motivo === 'senha_atual_invalida') return 'A senha atual não confere.'
  if (r.motivo === 'sem_sessao') return 'Sua sessão acabou. Entre de novo.'
  const partes = r.faltas.map((f) => TEXTO_DA_FALTA[f])
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
  return `A nova senha precisa ${lista}.`
}
