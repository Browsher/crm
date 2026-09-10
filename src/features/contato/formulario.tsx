'use client'

import { useActionState, useState } from 'react'
import { registrarContatoAcao, type EstadoContato } from './acao'
import { DESFECHO_SUGERIDO, EXIGE_POSSE, ROTULO, TIPOS_CONTATO, type TipoContato } from './tipos'

// Estado inicial DENTRO do componente cliente, nunca exportado de um arquivo
// 'use server': o Next transformaria a constante numa referência de servidor e
// o cliente receberia função em vez de objeto. É o que
// app/usuarios/formulario-criar.tsx:5 sempre fez.
const INICIAL: EstadoContato = { erro: null, ok: false }

// `tipoInicial` existe para o render alcançar os outros ramos sem DOM: sem
// clique não há como mudar o `useState`, e o aviso de desfecho passou a
// depender do tipo escolhido.
type Props = {
  empresaId: string
  posse: boolean
  comDevolver?: boolean
  tipoInicial?: TipoContato
  voltarPara?: string
}

export function FormularioContato({ empresaId, posse, comDevolver, tipoInicial, voltarPara }: Props) {
  const oferecidos = TIPOS_CONTATO.filter((t) => EXIGE_POSSE[t] === posse)
  const [tipo, setTipo] = useState<TipoContato>(tipoInicial ?? oferecidos[0])
  const [estado, agir, pendente] = useActionState(registrarContatoAcao, INICIAL)

  // O que decide o aviso é o DESFECHO do tipo escolhido, não `posse`. Antes o
  // aviso era fixo por posse e mentia em `interessado`, que assume a empresa em
  // vez de devolvê-la — achado da verificação manual.
  const desfecho = DESFECHO_SUGERIDO[tipo]

  return (
    <form action={agir} className="flex flex-col gap-3 border-t pt-3">
      <input type="hidden" name="id" value={empresaId} />
      <input type="hidden" name="posse" value={posse ? 'sim' : 'nao'} />
      {voltarPara ? <input type="hidden" name="voltarPara" value={voltarPara} /> : null}

      {estado.erro ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{estado.erro}</p>
      ) : null}

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">O que aconteceu na ligação</legend>
        {oferecidos.map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm">
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
            {ROTULO[t]}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Nota
        <textarea name="nota" rows={2} className="rounded border p-2" />
      </label>

      {posse ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Próximo passo
            <input type="text" name="proximoPasso" className="rounded border p-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data do próximo passo
            <input type="date" name="proximoPassoData" className="rounded border p-2" />
          </label>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Combinado (opcional)
            <input type="text" name="proximoPasso" className="rounded border p-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data combinada (opcional)
            <input type="date" name="proximoPassoData" className="rounded border p-2" />
          </label>
          {desfecho === 'devolver' ? (
            /* A promessa que o sistema NÃO cumpre, dita com todas as letras.
               Sem esta frase o vendedor acredita que agendou alguma coisa. */
            <p className="text-sm text-neutral-600">
              A empresa volta para a fila em 30 dias. A data fica registrada no histórico e não agenda nada.
            </p>
          ) : (
            <p className="text-sm text-neutral-600">
              A empresa vai para a sua carteira, e o combinado passa a valer como próximo passo.
            </p>
          )}
        </>
      )}

      {comDevolver ? (
        <>
        <p className="text-sm text-neutral-600">
          Devolver tira a empresa da sua carteira e ela volta para a fila em 30 dias.
        </p>
        <div className="flex gap-2">
          <button
            type="submit"
            name="desfecho"
            value={desfecho}
            disabled={pendente}
            className="rounded border px-3 py-2 text-sm font-medium"
          >
            {pendente ? 'Registrando…' : 'Registrar'}
          </button>
          <button
            type="submit"
            name="desfecho"
            value="devolver"
            disabled={pendente}
            className="rounded border px-3 py-2 text-sm"
          >
            Registrar e devolver
          </button>
        </div>
        </>
      ) : (
        <>
          <input type="hidden" name="desfecho" value={desfecho} />
          <button
            type="submit"
            disabled={pendente}
            className="self-start rounded border px-3 py-2 text-sm font-medium"
          >
            {pendente ? 'Registrando…' : 'Registrar'}
          </button>
        </>
      )}
    </form>
  )
}
