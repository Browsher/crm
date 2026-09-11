'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigir } from '../../server/autenticacao/guarda'
import { textoDaFalta, textoDoMotivo } from './mensagens'
import { validar } from './regras'
import { registrarContato } from './repositorio'

export type EstadoContato = { erro: string | null; ok: boolean }

// A action ÚNICA das duas telas. Mora em src/features e não em app/ porque a
// convenção de action junto da rota serve quando há UMA rota; com duas, pô-la
// em app/carteira/[id]/ criaria uma dependência de rota para rota que ninguém
// adivinha lendo /fila.
//
// Nenhuma constante é exportada daqui: arquivo 'use server' só exporta função,
// e constante exportada vira referência de servidor. Os textos moram em
// mensagens.ts, e o estado inicial mora no componente cliente.
export async function registrarContatoAcao(
  _anterior: EstadoContato,
  form: FormData,
): Promise<EstadoContato> {
  const eu = await exigir('usuario')
  const empresaId = String(form.get('id') ?? '')
  // Só a ficha manda `voltarPara`: ela é a única tela cuja ROTA deixa de
  // existir quando a empresa sai da mão do vendedor. A fila não manda, porque
  // /fila continua sendo /fila depois de devolver.
  const voltarPara = String(form.get('voltarPara') ?? '')
  const r = validar({
    tipo: String(form.get('tipo') ?? ''),
    desfecho: String(form.get('desfecho') ?? ''),
    nota: String(form.get('nota') ?? ''),
    proximoPasso: String(form.get('proximoPasso') ?? ''),
    proximoPassoData: String(form.get('proximoPassoData') ?? ''),
    posse: form.get('posse') === 'sim',
  })
  if (!r.ok) return { erro: textoDaFalta(r.falta), ok: false }

  const gravado = await registrarContato(eu.usuarioId, empresaId, r.valor)
  if (!gravado.ok) return { erro: textoDoMotivo(gravado.motivo), ok: false }

  revalidatePath('/fila')
  revalidatePath('/fila/localizar')
  revalidatePath('/carteira')
  revalidatePath(`/carteira/${empresaId}`)

  // Devolver tira a empresa da carteira, e `/carteira/[id]` passa a responder
  // 404 para ela. Sem isto, a ação dava certo e a revalidação da própria rota
  // renderizava a página que não existe mais — erro na tela depois do sucesso.
  // `redirect` lança por desenho: nada depois dele executa.
  if (r.valor.desfecho === 'devolver' && voltarPara) redirect(voltarPara)

  return { erro: null, ok: true }
}
