'use client'

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Contato } from '@/src/features/contato/historico'
import { FormularioContato } from '@/src/features/contato/formulario'
import { rascunhoAlterado } from '@/src/features/contato/rascunho'
import type { RascunhoContato } from '@/src/features/contato/rascunho'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { agirNaFilaAcao, type EstadoFila } from './acoes'
import { Cartao } from './cartao'
import { CamposReserva } from './campos-reserva'
import { useRascunhos } from './rascunhos'
import { RegistrarVisita } from './localizar/registrar-visita'
import { EtapasFila } from './etapas'
import { useTemaFila } from './tema'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'

const INICIAL: EstadoFila = { erro: null, filaVazia: false }
const SEM_FILTROS: Filtros = { nome:'',cnae:null,uf:null,cidade:null,bairro:null,pagina:1 }

export function Formulario({ reserva, contatos, contexto = null, filtros = SEM_FILTROS }: {
  reserva: EmpresaComigo | null; contatos: Contato[]; contexto?: string | null; filtros?: Filtros
}) {
  const rascunhos = useRascunhos()
  const tema = useTemaFila()
  const router = useRouter()
  const [trocaPendente, setTrocaPendente] = useState<{ form: HTMLFormElement, submitter: HTMLButtonElement } | null>(null)
  const [descartePendente, setDescartePendente] = useState<string | null>(null)
  const trocaConfirmada = useRef(false)
  const [agora, setAgora] = useState(() => new Date())
  const atualizado = useRef<string | null>(null)
  const prazo = reserva?.reservadoAte?.getTime()
  const expirada = prazo !== undefined && prazo <= agora.getTime()
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (expirada && reserva && atualizado.current !== `${reserva.id}:${prazo}`) {
      atualizado.current = `${reserva.id}:${prazo}`
      rascunhos.marcarExpirada(reserva.id, reserva.razaoSocial)
      router.refresh()
    }
  }, [expirada, reserva, prazo, router, rascunhos])

  const [estado, agir, pendente] = useActionState(async (anterior: EstadoFila, form: FormData) => {
    const idAnterior = reserva?.id
    rascunhos.setGravando(true)
    try {
      const r = await agirNaFilaAcao(anterior, form)
      if (r.resultado === 'ok' && idAnterior && r.empresaId !== idAnterior) rascunhos.limpar(idAnterior)
      return r
    } finally { rascunhos.setGravando(false) }
  }, INICIAL)

  function conferirTroca(evento: FormEvent<HTMLFormElement>) {
    if (rascunhos.gravando || pendente) { evento.preventDefault(); return }
    const botao = (evento.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (trocaConfirmada.current) { trocaConfirmada.current = false; return }
    const alvo = String(new FormData(evento.currentTarget).get('empresaId') ?? '')
    if (botao?.value === 'renovar' && alvo === reserva?.id) return
    const alterado = reserva && rascunhos.entradas[reserva.id]?.valor
    if (alterado && rascunhoAlterado(alterado) && botao) {
      evento.preventDefault()
      setTrocaPendente({ form: evento.currentTarget, submitter: botao })
    }
  }

  function confirmarTroca() {
    if (!trocaPendente) return
    trocaConfirmada.current = true
    trocaPendente.form.requestSubmit(trocaPendente.submitter)
    setTrocaPendente(null)
  }

  return <div className="flex flex-col gap-4">
    {estado.erro && <p role="alert" className="rounded border p-3 text-sm">{estado.erro}</p>}
    <p className="text-sm">A próxima empresa respeita os filtros da busca atual.</p>
    <form action={agir} onSubmit={conferirTroca} className="flex flex-wrap gap-3">
      <CamposReserva filtros={filtros} contexto={contexto} />
      <Button type="submit" name="acao" value="puxar" variant="outline" disabled={pendente || rascunhos.gravando}>
        {pendente ? 'Buscando…' : reserva ? 'Próxima' : 'Puxar próxima'}
      </Button>
    </form>
    {!reserva && <p className="text-sm">Nenhuma empresa reservada para você agora.</p>}
    {estado.filaVazia && !estado.erro && <p className="rounded border p-3 text-sm">Nenhuma empresa disponível agora. As demais estão com alguém ou foram trabalhadas nos últimos 30 dias.</p>}
    {reserva && <>
      <RegistrarVisita empresaId={reserva.id} />
      <Atendimento key={reserva.id} empresa={reserva} agora={agora} contatos={contatos} filtros={filtros}
        rascunho={rascunhos.entradas[reserva.id]?.valor}
        onDraftChange={valor => rascunhos.atualizar(reserva.id, reserva.razaoSocial, valor)}
        onSaved={rascunhos.limpar} bloqueado={pendente || expirada}
        bloqueioNavegacao={pendente || expirada || rascunhos.gravando} somenteLeitura={pendente}
        onPendingChange={rascunhos.setGravando} />
      {expirada && <form action={agir} onSubmit={conferirTroca}>
        <CamposReserva filtros={filtros} contexto={contexto} />
        <input type="hidden" name="empresaId" value={reserva.id} />
        <Button type="submit" name="acao" value="renovar" variant="outline" disabled={pendente || rascunhos.gravando}>Tentar reservar novamente</Button>
      </form>}
    </>}
    {Object.entries(rascunhos.entradas).filter(([id,e]) => id !== reserva?.id && (e.expirada || rascunhoAlterado(e.valor))).map(([id,entrada]) => (
      <section key={id} className="rounded border p-4" aria-label={`Anotações de ${entrada.nome}`}>
        <h2 className="font-semibold">{entrada.nome}</h2>
        <p>Você não tem esta reserva ativa. Suas anotações foram preservadas.</p>
        <FormularioContato empresaId={id} posse={false} rascunho={entrada.valor} bloqueado visual="fila"
          onDraftChange={valor => rascunhos.atualizar(id,entrada.nome,valor)} />
        <form action={agir} onSubmit={conferirTroca} className="mt-3">
          <CamposReserva filtros={filtros} contexto={contexto} />
          <input type="hidden" name="empresaId" value={id} />
          <Button type="submit" name="acao" value="renovar" variant="outline" disabled={pendente || rascunhos.gravando}>Tentar reservar novamente</Button>
        </form>
        <Button type="button" variant="ghost" className="mt-3" onClick={() => setDescartePendente(id)}>Descartar anotações</Button>
      </section>
    ))}
    <Dialog open={trocaPendente !== null} onOpenChange={aberto => { if (!aberto) setTrocaPendente(null) }}>
      <DialogContent theme={tema}>
        <DialogHeader>
          <DialogTitle>Trocar de empresa e descartar as anotações?</DialogTitle>
          <DialogDescription>As anotações não salvas desta empresa serão descartadas se você continuar.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <DialogClose asChild><Button onClick={confirmarTroca}>Descartar e continuar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={descartePendente !== null} onOpenChange={aberto => { if (!aberto) setDescartePendente(null) }}>
      <DialogContent theme={tema}>
        <DialogHeader>
          <DialogTitle>Descartar estas anotações não salvas?</DialogTitle>
          <DialogDescription>Esta ação remove o rascunho preservado desta empresa.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <DialogClose asChild><Button variant="destructive" onClick={() => {
            if (descartePendente) rascunhos.limpar(descartePendente)
            setDescartePendente(null)
          }}>Descartar anotações</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}

function Atendimento({ empresa, agora, contatos, filtros, bloqueioNavegacao, ...formulario }: {
  empresa: EmpresaComigo
  agora: Date
  contatos: Contato[]
  filtros: Filtros
  rascunho?: RascunhoContato
  onDraftChange?: (rascunho: RascunhoContato) => void
  onSaved?: (empresaId: string) => void
  bloqueado?: boolean
  bloqueioNavegacao?: boolean
  somenteLeitura?: boolean
  onPendingChange?: (pendente: boolean) => void
}) {
  const [etapa, setEtapa] = useState<'consultar' | 'registrar'>('consultar')
  return <>
    <EtapasFila etapa={etapa} filtros={filtros} onConsultar={() => setEtapa('consultar')}
      bloqueado={bloqueioNavegacao} />
    <Cartao empresa={empresa} agora={agora} contatos={contatos} {...formulario}
      etapa={etapa} onRegistrar={() => setEtapa('registrar')} />
  </>
}
