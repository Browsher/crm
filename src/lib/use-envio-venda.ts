'use client'
import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { chaveSessaoVenda, formularioVenda, lerComandoVenda, limparVendaConfirmada, persistirComandoVenda, type ComandoVenda, type EstadoVenda } from './venda-envio'

const EVENTO = 'crm-venda'
// A promessa pode sobreviver ao editor que iniciou o envio. A trava pertence
// ao ator neste documento, para que modal, quadro e remontagens a compartilhem.
const emVoo = new Set<string>()
const confirmadasSemLimpeza = new Map<string, string>()

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar)
  return () => window.removeEventListener(EVENTO, avisar)
}

function snapshot(usuarioId: string) {
  try { return sessionStorage.getItem(chaveSessaoVenda(usuarioId)) ?? '' }
  catch { return '!erro' }
}

function avisar() { window.dispatchEvent(new Event(EVENTO)) }

export function useEnvioVenda(usuarioId: string, acao: (form: FormData, comando: ComandoVenda) => Promise<EstadoVenda>) {
  const bruto = useSyncExternalStore(assinar, () => snapshot(usuarioId), () => null)
  const pendente = useSyncExternalStore(assinar, () => emVoo.has(usuarioId), () => false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<EstadoVenda | null>(null)
  const vivo = useRef(true)
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])

  let comando: ComandoVenda | null = null
  let erroLeitura = ''
  try { if (bruto) comando = lerComandoVenda(usuarioId) }
  catch { erroLeitura = 'Não foi possível recuperar a venda anterior. Preserve esta aba e atualize a página.' }
  const bloqueada = bruto === null || pendente || !!erroLeitura || !!comando
  if (comando && confirmadasSemLimpeza.get(usuarioId) === JSON.stringify(comando)) comando = null

  function iniciarNovo(): boolean {
    if (emVoo.has(usuarioId)) return false
    try { if (lerComandoVenda(usuarioId)) return false } catch { return false }
    setResultado(null)
    setErro('')
    return true
  }

  async function enviar(novo?: ComandoVenda): Promise<EstadoVenda | undefined> {
    const esperado = novo ?? comando
    if (!esperado || bruto === null || emVoo.has(usuarioId)) return
    emVoo.add(usuarioId)
    setErro('')
    try {
      let primeiraTransmissao: boolean
      try {
        const anterior = lerComandoVenda(usuarioId)
        if (novo) {
          if (novo.usuarioId !== usuarioId || anterior) throw Error('Confirme o envio anterior')
        } else {
          const salvo = JSON.stringify(anterior)
          // Um botão antigo não recria um envio removido nem usa outra intenção.
          if (salvo !== JSON.stringify(esperado) || salvo === confirmadasSemLimpeza.get(usuarioId)) return
        }
        primeiraTransmissao = !!novo
        persistirComandoVenda(esperado)
        if (primeiraTransmissao) {
          confirmadasSemLimpeza.delete(usuarioId)
          setResultado(null)
        }
        avisar()
      } catch {
        if (vivo.current) setErro('Não foi possível armazenar a venda. Nenhum novo envio foi feito. Preserve esta aba e confira o envio anterior.')
        return
      }

      let r: EstadoVenda
      try {
        r = await new Promise<EstadoVenda>((resolve, reject) => startTransition(() => {
          try { acao(formularioVenda(esperado), esperado).then(resolve, reject) }
          catch (erro) { reject(erro) }
        }))
      } catch {
        if (vivo.current) setErro('Não foi possível confirmar o resultado. Confirme o envio anterior com os mesmos dados.')
        return
      }

      // Limpeza local não desfaz a confirmação. A recusa de campos só libera
      // a primeira transmissão deste ciclo vivo, nunca a recuperação.
      if (r.ok || r.recusaConclusiva || primeiraTransmissao && vivo.current && r.erroDeCampos) {
        try {
          limparVendaConfirmada(esperado)
          confirmadasSemLimpeza.delete(usuarioId)
        } catch {
          if (r.ok) {
            confirmadasSemLimpeza.set(usuarioId, JSON.stringify(esperado))
            r = { ...r, aviso: 'Venda registrada. Não foi possível limpar o envio desta aba. Atualize a página para conferir.' }
          }
        }
      }
      if (vivo.current) {
        setResultado(r)
        setErro(r.ok ? '' : r.erro)
      }
      return r
    } finally {
      emVoo.delete(usuarioId)
      avisar()
    }
  }

  return { comando, pendente, erro: erro || erroLeitura, resultado, bloqueada, iniciarNovo, enviar }
}
