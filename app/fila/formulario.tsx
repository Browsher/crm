'use client'

import { useActionState } from 'react'
import type { Contato } from '@/src/features/contato/historico'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import { agirNaFilaAcao, type EstadoFila } from './acoes'
import { Cartao } from './cartao'

const INICIAL: EstadoFila = { erro: null, filaVazia: false }

// Cliente porque o resultado da ação precisa aparecer sem recarregar: o erro e
// o "a fila não tinha nada". `agora` é criado aqui, uma vez por render, e
// desce para o Cartao — que continua puro e testável sem relógio congelado.
//
// O Cartao ficou FORA deste <form>: ele traz o próprio formulário de contato,
// e formulário aninhado é HTML inválido. Este form sobrou só para o "Puxar
// próxima", que é a única ação que restou em `agirNaFilaAcao`.
export function Formulario({ reserva, contatos }: { reserva: EmpresaComigo | null; contatos: Contato[] }) {
  const [estado, agir, pendente] = useActionState(agirNaFilaAcao, INICIAL)

  if (reserva) {
    return (
      <div className="flex flex-col gap-3">
        {estado.erro ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{estado.erro}</p>
        ) : null}
        <Cartao empresa={reserva} agora={new Date()} contatos={contatos} />
      </div>
    )
  }

  return (
    <form action={agir} className="flex flex-col gap-3">
      {estado.erro ? <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{estado.erro}</p> : null}
      <p className="text-sm text-neutral-600">Nenhuma empresa reservada para você agora.</p>
      {/* Fila vazia não é erro: a função respondeu, e a resposta é "não há
          candidata". O texto diz POR QUE, que é o passo 10 da verificação
          manual — e não diz "quarentena", palavra que descreveria uma
          barreira que este desenho não tem. */}
      {estado.filaVazia ? (
        <p className="rounded border border-dashed p-3 text-sm">
          Nenhuma empresa disponível agora — as demais estão com alguém ou foram trabalhadas nos últimos 30 dias.
        </p>
      ) : null}
      <button
        type="submit"
        name="acao"
        value="puxar"
        disabled={pendente}
        className="self-start rounded border px-3 py-2 text-sm font-medium"
      >
        {pendente ? 'Puxando…' : 'Puxar próxima'}
      </button>
    </form>
  )
}
