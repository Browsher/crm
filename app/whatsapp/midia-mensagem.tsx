'use client'

import { useEffect, useRef, useState } from 'react'
import type { Midia } from '@/src/lib/whatsapp-midia'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog'
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
    {!url && <button className={styles.midiaBotao} type="button" onClick={carregar} disabled={carregando}>
      {carregando ? 'Carregando arquivo…' : erro ? 'Tentar novamente' : midia.tipo === 'imagem' ? 'Carregar imagem' : midia.tipo === 'audio' ? 'Carregar áudio' : `Carregar documento: ${nome}`}
    </button>}
    {url && midia.tipo === 'imagem' && <Dialog>
      <DialogTrigger asChild><button type="button" className={styles.miniatura} aria-label="Ampliar imagem">
        {/* Arquivo privado carregado como blob, sem passar pelo otimizador público. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={midia.legenda || 'Imagem da conversa'} onError={falhouReproducao} />
      </button></DialogTrigger>
      <DialogContent className={styles.imagemDialogo} aria-describedby={undefined}>
        <DialogTitle>Imagem da conversa</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={midia.legenda || 'Imagem ampliada'} />
      </DialogContent>
    </Dialog>}
    {url && midia.tipo === 'audio' && <audio aria-label="Áudio da conversa" controls preload="metadata" src={url} onError={falhouReproducao} />}
    {url && midia.tipo === 'documento' && <a className={styles.midiaBotao} href={url} download={nome}>Baixar {nome}</a>}
    {midia.legenda && <span>{midia.legenda}</span>}
    {erro && <p role="alert">{erro}</p>}
  </div>
}
