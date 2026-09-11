'use client'

import { useActionState, useId, useState } from 'react'
import { registrarContatoAcao, type EstadoContato } from './acao'
import { DESFECHO_SUGERIDO, EXIGE_POSSE, ROTULO, TIPOS_CONTATO, type TipoContato } from './tipos'
import { rascunhoInicial, type RascunhoContato } from './rascunho'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Textarea } from '@/src/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'

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
  rascunho?: RascunhoContato
  onDraftChange?: (rascunho: RascunhoContato) => void
  onSaved?: (empresaId: string) => void
  bloqueado?: boolean
  somenteLeitura?: boolean
  onPendingChange?: (pendente: boolean) => void
  visual?: 'fila'
}

export function FormularioContato({ empresaId, posse, comDevolver, tipoInicial, voltarPara,
  rascunho, onDraftChange, onSaved, bloqueado = false, somenteLeitura = false, onPendingChange, visual }: Props) {
  const camposId = useId()
  const oferecidos = TIPOS_CONTATO.filter((t) => EXIGE_POSSE[t] === posse)
  const [interno, setInterno] = useState<RascunhoContato>(() => ({ ...rascunhoInicial(posse), tipo: tipoInicial ?? oferecidos[0] }))
  const atual = rascunho ?? interno
  const tipo = atual.tipo
  function alterar(mudanca: Partial<RascunhoContato>) {
    const proximo = { ...atual, ...mudanca }
    setInterno(proximo)
    onDraftChange?.(proximo)
  }
  const [estado, agir, pendente] = useActionState(async (anterior: EstadoContato, form: FormData) => {
    if (bloqueado) return { erro: 'O envio está bloqueado. Verifique sua reserva.', ok: false }
    onPendingChange?.(true)
    try {
      const resultado = await registrarContatoAcao(anterior, form)
      if (resultado.ok) {
        setInterno(rascunhoInicial(posse))
        onSaved?.(empresaId)
      }
      return resultado
    } finally {
      onPendingChange?.(false)
    }
  }, INICIAL)

  // O que decide o aviso é o DESFECHO do tipo escolhido, não `posse`. Antes o
  // aviso era fixo por posse e mentia em `interessado`, que assume a empresa em
  // vez de devolvê-la — achado da verificação manual.
  const desfecho = DESFECHO_SUGERIDO[tipo]
  const CampoTexto = visual === 'fila' ? Input : 'input'
  const CampoNota = visual === 'fila' ? Textarea : 'textarea'
  const Rotulo = visual === 'fila' ? Label : 'label'
  const Botao = visual === 'fila' ? Button : 'button'

  return (
    <form data-visual={visual} action={agir} onSubmit={evento => {
      if (bloqueado || pendente) evento.preventDefault()
    }} className={visual === 'fila' ? 'flex flex-col gap-4' : 'flex flex-col gap-3 border-t pt-3'}>
      <input type="hidden" name="id" value={empresaId} />
      <input type="hidden" name="posse" value={posse ? 'sim' : 'nao'} />
      {voltarPara ? <input type="hidden" name="voltarPara" value={voltarPara} /> : null}

      {estado.erro ? visual === 'fila' ? (
        <Alert variant="danger">
          <AlertTitle>Não foi possível registrar</AlertTitle>
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{estado.erro}</p> : null}

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">O que aconteceu na ligação</legend>
        {oferecidos.map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm">
            <input type="radio" disabled={pendente || somenteLeitura} name="tipo" value={t} checked={tipo === t} onChange={() => alterar({ tipo: t })} />
            {ROTULO[t]}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1 text-sm">
        <Rotulo htmlFor={`${camposId}-nota`}>Nota</Rotulo>
        <CampoNota id={`${camposId}-nota`} name="nota" readOnly={pendente || somenteLeitura} rows={2} value={atual.nota} onChange={e => alterar({ nota: e.target.value })} className="rounded border p-2" />
      </div>

      {posse ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Próximo passo
            <CampoTexto type="text" name="proximoPasso" readOnly={pendente || somenteLeitura} value={atual.proximoPasso} onChange={e => alterar({ proximoPasso: e.target.value })} className="rounded border p-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data do próximo passo
            <CampoTexto type="date" name="proximoPassoData" readOnly={pendente || somenteLeitura} value={atual.proximoPassoData} onChange={e => alterar({ proximoPassoData: e.target.value })} className="rounded border p-2" />
          </label>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Combinado (opcional)
            <CampoTexto type="text" name="proximoPasso" readOnly={pendente || somenteLeitura} value={atual.proximoPasso} onChange={e => alterar({ proximoPasso: e.target.value })} className="rounded border p-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data combinada (opcional)
            <CampoTexto type="date" name="proximoPassoData" readOnly={pendente || somenteLeitura} value={atual.proximoPassoData} onChange={e => alterar({ proximoPassoData: e.target.value })} className="rounded border p-2" />
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
          <Botao
            type="submit"
            name="desfecho"
            value={desfecho}
            disabled={pendente || bloqueado}
            className="rounded border px-3 py-2 text-sm font-medium"
          >
            {pendente ? 'Registrando…' : 'Registrar'}
          </Botao>
          <Botao
            type="submit"
            name="desfecho"
            value="devolver"
            disabled={pendente || bloqueado}
            className="rounded border px-3 py-2 text-sm"
          >
            Registrar e devolver
          </Botao>
        </div>
        </>
      ) : (
        <>
          <input type="hidden" name="desfecho" value={desfecho} />
          <Botao
            type="submit"
            disabled={pendente || bloqueado}
            className="self-start rounded border px-3 py-2 text-sm font-medium"
          >
            {pendente ? 'Registrando…' : 'Registrar'}
          </Botao>
        </>
      )}
    </form>
  )
}
