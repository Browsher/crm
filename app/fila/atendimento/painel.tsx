'use client'

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent } from '@/src/components/ui/dialog'
import { ConfirmacaoPainelCrm } from '@/src/components/crm/confirmacao-painel'
import { ConteudoConsultaEmpresa } from '@/src/components/crm/empresa-dialogo'
import type { GrupoEmpresa } from '@/src/components/crm/empresa-detalhes'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { useGuardaPainelEdicao } from '@/src/components/crm/guarda-painel-edicao'
import { useTemaCrm } from '@/src/components/crm/tema'
import { contatoPendente, descartarRascunhoContato, rascunhoAlterado } from '@/src/features/contato/rascunho'
import { rotuloSituacao } from '@/src/lib/empresa-visual'
import { Formulario, type PropsFormulario } from '../formulario'
import { ID_TITULO_RESULTADOS, idGatilhoAtendimento } from '../localizar/navegacao'
import { useRascunhos } from '../rascunhos'

function assinarEnvio(avisar: () => void) {
  window.addEventListener('crm-contato', avisar)
  return () => window.removeEventListener('crm-contato', avisar)
}

export function PainelAtendimento({ empresaId, ...dados }: Omit<PropsFormulario, 'lateral'> & { empresaId: string }) {
  const router = useRouter()
  const tema = useTemaCrm()
  const rascunhos = useRascunhos()
  const [destinoAcoes, setDestinoAcoes] = useState<HTMLDivElement | null>(null)
  const [alterado, setAlterado] = useState(() => {
    const anterior = rascunhos.entradas[empresaId]
    return anterior ? rascunhoAlterado(anterior.valor) : false
  })
  const [pendente, setPendente] = useState(false)
  const [erroDescarte, setErroDescarte] = useState('')
  const [dadosAbertos, setDadosAbertos] = useState(false)
  const [grupo, setGrupo] = useState<GrupoEmpresa | null>(null)
  const envioEmVoo = useRef(false)
  const neutro = useRef<HTMLButtonElement>(null)
  const abrirDados = useRef<HTMLButtonElement>(null)
  const tituloDados = useRef<HTMLHeadingElement>(null)
  const rolagemEditor = useRef<number | null>(null)
  const envioPendente = useSyncExternalStore(assinarEnvio, () => contatoPendente(empresaId), () => false)
  const guarda = useGuardaPainelEdicao(alterado || envioPendente, pendente, () => envioEmVoo.current, saida => {
    if (typeof saida === 'function') saida()
    else router.back()
  })

  useLayoutEffect(() => {
    const alvo = dadosAbertos ? tituloDados.current : abrirDados.current
    const corpo = alvo?.closest<HTMLElement>('[data-painel-corpo]')
    if (!alvo || !corpo || rolagemEditor.current === null) return
    corpo.scrollTop = dadosAbertos ? 0 : rolagemEditor.current
    alvo.focus({ preventScroll: true })
    if (!dadosAbertos) rolagemEditor.current = null
  }, [dadosAbertos])

  function voltar() {
    if (grupo) setGrupo(null)
    else if (dadosAbertos) setDadosAbertos(false)
    else guarda.pedir('ficha')
  }

  function mudarEnvio(valor: boolean) {
    envioEmVoo.current = valor
    // O cabeçalho acompanha a trava síncrona sem esperar a action terminar.
    queueMicrotask(() => setPendente(valor))
  }

  function cancelarDescarte() {
    setErroDescarte('')
    guarda.cancelar()
  }

  function descartar() {
    if (envioEmVoo.current) return
    if (!descartarRascunhoContato(empresaId)) {
      setErroDescarte('Não foi possível descartar as anotações. Você pode fechar mantendo o rascunho.')
      return
    }
    rascunhos.limpar(empresaId)
    guarda.confirmar()
  }

  return <>
    <Dialog open={!guarda.restaurando}>
      <PainelSobrepostoCrm titulo={dados.empresa.nome} descricao={rotuloSituacao(dados.empresa.situacao)}
        aoFechar={voltar} rotuloFechar={dadosAbertos ? 'Voltar' : 'Fechar'} fecharBloqueado={pendente || Boolean(guarda.pedido)}
        ocupado={pendente} rodape={dadosAbertos ? null : <div ref={setDestinoAcoes} />} onCloseAutoFocus={evento => {
          evento.preventDefault()
          const gatilho = document.getElementById(idGatilhoAtendimento(empresaId))
          const alvo = gatilho instanceof HTMLButtonElement && !gatilho.disabled
            ? gatilho
            : document.getElementById(ID_TITULO_RESULTADOS)
          alvo?.focus({ preventScroll: true })
        }}>
        <div hidden={dadosAbertos}>
          <Button ref={abrirDados} type="button" variant="outline" className="mb-4" disabled={pendente}
            onClick={evento => {
              if (envioEmVoo.current) return
              rolagemEditor.current = evento.currentTarget.closest('[data-painel-corpo]')?.scrollTop ?? 0
              setDadosAbertos(true)
            }}>Dados da empresa</Button>
          <Formulario {...dados} lateral={{
            destinoAcoes,
            aoEditar: valor => setAlterado(rascunhoAlterado(valor)),
            aoSalvar: navegar => {
              setAlterado(false)
              if (navegar) guarda.concluir(navegar)
            },
            aoMudarEnvio: mudarEnvio,
            aoCancelar: () => guarda.pedir('ficha'),
          }} />
        </div>
        {dadosAbertos && <section className="grid gap-4">
          <h3 ref={tituloDados} tabIndex={-1}>Dados da empresa</h3>
          <ConteudoConsultaEmpresa referencia={dados.empresa.referencia} grupo={grupo} aoAbrir={setGrupo} />
        </section>}
      </PainelSobrepostoCrm>
    </Dialog>
    <Dialog open={Boolean(guarda.pedido)} onOpenChange={aberto => { if (!aberto) cancelarDescarte() }}>
      <DialogContent theme={tema} showCloseButton={false}
        onOpenAutoFocus={evento => { evento.preventDefault(); neutro.current?.focus() }}
        onCloseAutoFocus={evento => {
          evento.preventDefault()
          if (guarda.foco.current?.isConnected) guarda.foco.current.focus({ preventScroll: true })
        }}>
        <ConfirmacaoPainelCrm titulo={envioPendente ? 'Fechar com envio pendente?' : 'Descartar alterações?'}
          alvo={<strong>{dados.empresa.nome}</strong>}
          descricao={envioPendente ? 'Você poderá confirmar o mesmo envio ao continuar este atendimento.' : 'Você pode manter ou descartar as anotações deste atendimento.'}
          acoes={<>
            <Button ref={neutro} type="button" variant="outline" onClick={cancelarDescarte}>{envioPendente ? 'Voltar ao atendimento' : 'Continuar editando'}</Button>
            <Button type="button" variant="outline" onClick={guarda.confirmar}>{envioPendente ? 'Fechar mantendo envio' : 'Fechar mantendo rascunho'}</Button>
            {!envioPendente && <Button type="button" onClick={descartar}>Descartar alterações</Button>}
          </>}>{erroDescarte && <Alert variant="danger" role="alert">{erroDescarte}</Alert>}</ConfirmacaoPainelCrm>
      </DialogContent>
    </Dialog>
  </>
}
