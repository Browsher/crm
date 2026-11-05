'use client'
import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { NegociacaoResumo } from '@/src/features/funil/consulta'
import { semInteresseAcao, type EstadoFunil } from './acoes'

const EVENTO = 'crm-funil-arquivo'
const emVoo = new Set<string>()
type ComandoArquivo = { linha: NegociacaoResumo; chave: string }
function chaveSessao(usuarioId: string) { return 'crm:funil:arquivo:v1:' + usuarioId }
function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar)
  return () => window.removeEventListener(EVENTO, avisar)
}
function avisar() { window.dispatchEvent(new Event(EVENTO)) }
function snapshot(usuarioId: string) {
  try { return sessionStorage.getItem(chaveSessao(usuarioId)) ?? '' }
  catch { return '!erro' }
}
function ler(usuarioId: string): ComandoArquivo | null {
  const salvo = sessionStorage.getItem(chaveSessao(usuarioId))
  if (!salvo) return null
  const comando = JSON.parse(salvo) as ComandoArquivo
  if (!comando?.linha?.id || !comando.linha.empresaId || !Number.isInteger(comando.linha.versao) || comando.linha.versao < 1 || !comando.chave) throw Error('Comando inválido')
  return comando
}

// Só transporte, persistência e replay. A confirmação e o efeito visual pertencem ao consumidor.
export function useEnvioArquivo(usuarioId: string) {
  const bruto = useSyncExternalStore(assinar, () => snapshot(usuarioId), () => null)
  const pendente = useSyncExternalStore(assinar, () => emVoo.has(usuarioId), () => false)
  const [aviso, setAviso] = useState('')
  const vivo = useRef(true)
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])
  let comando: ComandoArquivo | null = null
  let erroLeitura = ''
  try { if (bruto) comando = ler(usuarioId) }
  catch { erroLeitura = 'Não foi possível recuperar o envio anterior. Atualize a página.' }

  async function transmitir(linha?: NegociacaoResumo): Promise<EstadoFunil | null> {
    if (bruto === null || emVoo.has(usuarioId)) return null
    emVoo.add(usuarioId)
    if (vivo.current) setAviso('')
    try {
      let esperado: ComandoArquivo
      try {
        const anterior = ler(usuarioId)
        if (linha) {
          if (anterior || linha.empresa.situacao === 'indisponivel' || linha.empresa.negociacaoId !== linha.id || linha.empresa.versao !== linha.versao) return null
          esperado = { linha, chave: crypto.randomUUID() }
        } else {
          if (!anterior || JSON.stringify(anterior) !== JSON.stringify(comando)) return null
          esperado = anterior
        }
        // Grava a intenção completa antes de qualquer transmissão, inclusive no replay.
        sessionStorage.setItem(chaveSessao(usuarioId), JSON.stringify(esperado))
        avisar()
      } catch {
        if (vivo.current) setAviso('Não foi possível salvar o envio nesta aba. Nenhum envio foi feito. Preserve a aba e confira o envio anterior.')
        return null
      }
      const form = new FormData()
      form.set('id', esperado.linha.id)
      form.set('empresaId', esperado.linha.empresaId)
      form.set('versao', String(esperado.linha.versao))
      form.set('chave', esperado.chave)
      let resultado: EstadoFunil
      try {
        resultado = await new Promise<EstadoFunil>((resolve, reject) => startTransition(() => {
          try { semInteresseAcao(form).then(resolve, reject) }
          catch (erro) { reject(erro) }
        }))
      } catch {
        if (vivo.current) setAviso('Não foi possível confirmar o resultado. Confirme o envio anterior com a mesma chave.')
        return null
      }
      if (resultado.ok || (resultado.motivo !== 'sem_permissao' && resultado.motivo !== 'nao_encontrada')) {
        try {
          // Uma resposta antiga nunca remove outra intenção gravada durante a espera.
          if (JSON.stringify(ler(usuarioId)) === JSON.stringify(esperado)) sessionStorage.removeItem(chaveSessao(usuarioId))
        } catch {
          if (vivo.current) setAviso('Operação respondida. Não foi possível limpar o envio desta aba. Atualize a página para conferir.')
        }
      }
      return vivo.current ? resultado : null
    } finally {
      emVoo.delete(usuarioId)
      avisar()
    }
  }

  return { comando, pendente, aviso: erroLeitura || aviso, enviar: (linha: NegociacaoResumo) => transmitir(linha), recuperar: () => transmitir() }
}
