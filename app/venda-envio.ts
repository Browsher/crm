import type { ComandoVenda } from '@/src/lib/venda-envio'
import { vendaCarteiraAcao } from './carteira/venda-acao'
import { vendaAcao } from './funil/acoes'

export function transmitirVenda(form: FormData, comando: ComandoVenda) {
  return comando.alvo.tipo === 'primeira' ? vendaAcao(form) : vendaCarteiraAcao(form)
}
