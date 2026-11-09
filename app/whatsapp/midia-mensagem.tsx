'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Midia } from '@/src/lib/whatsapp-midia'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { Dialog, DialogTrigger } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import styles from './whatsapp.module.css'

export function MidiaMensagem({ id, conversa, midia, fonte }: { id: string; conversa: string; midia: Midia; fonte?: string }) {
  const [url, mudarUrl] = useState<string | null>(null)
  const [carregando, mudarCarregando] = useState(false)
  const [erro, mudarErro] = useState('')
  const arquivo = useRef<string | null>(null)
  const requisicao = useRef<AbortController | null>(null)
  useEffect(() => () => {
    requisicao.current?.abort()
    if (arquivo.current) URL.revokeObjectURL(arquivo.current)
  }, [])

  function falhouReproducao() {
    if (arquivo.current) URL.revokeObjectURL(arquivo.current)
    arquivo.current = null
    mudarUrl(null)
    mudarErro('Não foi possível exibir este formato no navegador. Tente novamente.')
  }

  async function carregar() {
    if (requisicao.current) return
    const controle = new AbortController()
    requisicao.current = controle
    mudarCarregando(true)
    mudarErro('')
    try {
      const resposta = await fetch(`/whatsapp/midia/${encodeURIComponent(id)}?conversa=${encodeURIComponent(conversa)}${fonte ? `&fonte=${encodeURIComponent(fonte)}` : ''}`, {
        credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controle.signal,
      })
      if (!resposta.ok) {
        mudarErro(resposta.status === 413 ? 'Este arquivo ultrapassa o limite de 20 MB.'
          : resposta.status === 401 || resposta.status === 403 ? 'Acesso expirado ou não permitido. Entre novamente no CRM.'
          : 'Arquivo indisponível. Ele pode ter expirado no WhatsApp. Tente novamente.')
        return
      }
      const blob = await resposta.blob()
      if (controle.signal.aborted) return
      arquivo.current = URL.createObjectURL(blob)
      mudarUrl(arquivo.current)
    } catch {
      if (!controle.signal.aborted) mudarErro('Arquivo indisponível. Verifique a conexão e tente novamente.')
    } finally {
      if (!controle.signal.aborted) { requisicao.current = null; mudarCarregando(false) }
    }
  }

  const nome = midia.nome?.replace(/[\x00-\x1f\x7f/\\]/g, '_') || 'documento'
  return <div className={styles.midia}>
    {!url && <Button variant="outline" className={styles.midiaBotao} type="button" onClick={carregar} disabled={carregando}>
      {carregando ? 'Carregando arquivo…' : erro ? 'Tentar novamente' : midia.tipo === 'imagem' ? 'Carregar imagem' : midia.tipo === 'audio' ? 'Carregar áudio' : `Carregar documento: ${nome}`}
    </Button>}
    {url && midia.tipo === 'imagem' && <ImagemMensagem url={url} legenda={midia.legenda} aoFalhar={falhouReproducao} />}
    {url && midia.tipo === 'audio' && <audio aria-label="Áudio da conversa" controls preload="metadata" src={url} onError={falhouReproducao} />}
    {url && midia.tipo === 'documento' && <Button asChild variant="outline" className={styles.midiaBotao}><a href={url} download={nome}>Baixar {nome}</a></Button>}
    {midia.legenda && <span>{midia.legenda}</span>}
    {erro && <Alert variant="danger">{erro}</Alert>}
  </div>
}

function ImagemMensagem({ url, legenda, aoFalhar }: { url: string; legenda?: string; aoFalhar: () => void }) {
  const [aberta, setAberta] = useState(false)
  return <Dialog open={aberta} onOpenChange={setAberta}>
    <DialogTrigger asChild><button type="button" className={styles.miniatura} aria-label="Ampliar imagem">
      {/* Arquivo privado carregado como blob, sem passar pelo otimizador público. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={legenda || 'Imagem da conversa'} width={260} height={240} onError={aoFalhar} />
    </button></DialogTrigger>
    {aberta && <VisualizacaoImagem url={url} legenda={legenda} aoFechar={() => setAberta(false)} />}
  </Dialog>
}

function VisualizacaoImagem({ url, legenda, aoFechar }: { url: string; legenda?: string; aoFechar: () => void }) {
  const [ampliada, setAmpliada] = useState(false)
  const figura = useRef<HTMLElement>(null)
  const botaoAmpliar = useRef<HTMLButtonElement>(null)
  const posicaoLeitura = useRef<number | null>(null)

  function ampliar() {
    posicaoLeitura.current = figura.current?.closest<HTMLElement>('[data-painel-corpo]')?.scrollTop ?? 0
    setAmpliada(true)
  }

  useLayoutEffect(() => {
    const alvo = figura.current
    const corpo = alvo?.closest<HTMLElement>('[data-painel-corpo]')
    if (!alvo || !corpo || posicaoLeitura.current === null) return
    corpo.scrollLeft = 0
    corpo.scrollTop = ampliada ? 0 : posicaoLeitura.current
    if (ampliada) alvo.focus({ preventScroll: true })
    else {
      botaoAmpliar.current?.focus({ preventScroll: true })
      posicaoLeitura.current = null
    }
  }, [ampliada])

  return <PainelSobrepostoCrm
    titulo={ampliada ? 'Imagem ampliada' : 'Imagem da conversa'}
    descricao={<span className="sr-only">Imagem compartilhada nesta conversa do WhatsApp.</span>}
    rotuloFechar={ampliada ? 'Voltar' : 'Fechar'}
    aoFechar={ampliada ? () => setAmpliada(false) : aoFechar}
    className={ampliada ? styles.imagemAmpliada : undefined}
    rodape={!ampliada && <Button ref={botaoAmpliar} type="button" variant="outline" onClick={ampliar}>Ampliar imagem</Button>}
  >
    <figure ref={figura} className={styles.imagemPainel} tabIndex={ampliada ? 0 : undefined}
      aria-label={ampliada ? 'Área de visualização ampliada' : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={legenda || 'Imagem da conversa'} />
      {!ampliada && legenda && <figcaption>{legenda}</figcaption>}
    </figure>
  </PainelSobrepostoCrm>
}
