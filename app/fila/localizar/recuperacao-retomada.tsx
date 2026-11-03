'use client'

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { textoDoMotivo } from '@/src/features/contato/mensagens'
import { urlPessoal, type FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { retomarAtendimentoAcao } from '../atendimento/acoes'
import { urlAtendimento } from './navegacao'

type Comando = { id: string; versao: number; chave: string }
type Envio = { storage: string; comando: Comando; registro: string }
type Intencao = { empresaId: string; versao: number }
type RetomarNaConsulta = (intencao: Intencao, filtros: FiltrosPessoais) => boolean
type Props = { usuarioId: string; filtros: FiltrosPessoais; children: ReactNode }
const BloqueioRetomada = createContext(false)
const RetomadaNaConsulta = createContext<RetomarNaConsulta | null>(null)
const PREFIXO_MODERNO = 'crm:acao-empresa:v1:'
export function useRetomadaBloqueada() { return useContext(BloqueioRetomada) }
export function useRetomadaNaConsulta() { return useContext(RetomadaNaConsulta) }
function lerComando(salvo: string): Comando {
  const c: unknown = JSON.parse(salvo)
  if (!c || typeof c !== 'object' || !('id' in c) || !('versao' in c) || !('chave' in c)
    || typeof c.id !== 'string' || !c.id || typeof c.chave !== 'string' || !c.chave
    || typeof c.versao !== 'number' || !Number.isSafeInteger(c.versao) || c.versao < 0) throw new Error('Comando inválido')
  return { id: c.id, versao: c.versao, chave: c.chave }
}
function lerEnvios(usuarioId: string): Envio[] {
  const envios: Envio[] = []
  const legado = 'crm:retomar-arquivo:v1:' + usuarioId
  const registro = sessionStorage.getItem(legado)
  if (registro) envios.push({ storage: legado, comando: lerComando(registro), registro })
  const chaves = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i))
    .filter((k): k is string => !!k?.startsWith(PREFIXO_MODERNO)).sort()
  for (const storage of chaves) {
    const salvo = sessionStorage.getItem(storage)
    if (!salvo) continue
    let c: unknown
    try { c = JSON.parse(salvo) } catch { continue }
    // Identidade apenas para recuperação local. O servidor continua autenticando
    // cada RPC e leitura. Registros antigos sem ator ficam no fallback do card.
    if (!c || typeof c !== 'object' || !('usuarioId' in c) || c.usuarioId !== usuarioId || !('tipo' in c) || c.tipo !== 'retomar') continue
    const comando = lerComando(salvo)
    if (storage !== PREFIXO_MODERNO + comando.id) throw new Error('Alvo de comando inválido')
    envios.push({ storage, comando, registro: salvo })
  }
  return envios
}
export function RecuperacaoRetomada(props: Props) { return <RecuperacaoUsuario key={props.usuarioId} {...props} /> }
function RecuperacaoUsuario({ usuarioId, filtros, children }: Props) {
  const [estado, setEstado] = useState<'carregando' | 'livre' | 'incerto' | 'confirmado'>('carregando')
  const [envio, setEnvio] = useState<Envio | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [pendente, iniciar] = useTransition()
  const ocupado = useRef(false)
  const vivo = useRef(true)
  const router = useRouter()
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])
  useEffect(() => {
    function recuperar() {
      try {
        const anterior = lerEnvios(usuarioId)[0] ?? null
        setEnvio(anterior); setEstado(anterior ? 'incerto' : 'livre')
        if (anterior) setMensagem('Confirme a retomada anterior antes de retomar outra empresa.')
      } catch { setEstado('incerto'); setMensagem('Não foi possível recuperar a retomada anterior. Atualize a página para conferir o envio.') }
    }
    recuperar()
  }, [usuarioId])
  function conferirRestantes() {
    const proximo = lerEnvios(usuarioId)[0]
    if (!proximo) return false
    setEnvio(proximo); setEstado('incerto')
    setMensagem('Envio anterior confirmado. Há outra retomada nesta aba. Confirme esse envio antes de continuar.')
    return true
  }
  function limparConfirmado(e: Envio) {
    const atual = sessionStorage.getItem(e.storage)
    if (atual && atual !== e.registro) {
      // Nunca apagar uma intenção posterior, mesmo no mesmo namespace/empresa.
      const proximo = lerEnvios(usuarioId)[0]
      setEnvio(proximo ?? null); setEstado('incerto')
      setMensagem('Envio anterior confirmado. Há outra retomada nesta aba. Confira esse envio antes de continuar.')
      return false
    }
    if (atual) sessionStorage.removeItem(e.storage)
    return !conferirRestantes()
  }
  function executar(e: Envio, contexto: FiltrosPessoais) {
    if (ocupado.current) return
    ocupado.current = true
    setEnvio(e); setEstado('incerto'); setMensagem('Confirmando retomada...')
    iniciar(async () => {
      try {
        if (sessionStorage.getItem(e.storage) !== e.registro) {
          const atual = lerEnvios(usuarioId)[0] ?? null
          setEnvio(atual); setEstado(atual ? 'incerto' : 'livre')
          setMensagem('A retomada desta aba mudou. Confira o envio anterior antes de continuar.')
          return
        }
        const f = new FormData()
        f.set('id', e.comando.id); f.set('versao', String(e.comando.versao)); f.set('chave', e.comando.chave)
        const r = await retomarAtendimentoAcao(f)
        if (!vivo.current) return
        if (!r.ok && (r.motivo === 'sem_permissao' || r.motivo === 'nao_encontrada')) {
          setMensagem(textoDoMotivo(r.motivo)); return
        }
        // Confirmação da RPC precede limpeza, refresh e navegação. O resultado
        // confirmado não pode voltar a aparecer como envio desconhecido.
        setEstado('confirmado')
        const confirmacao = r.ok ? (r.repetida ? 'Envio anterior confirmado.' : 'Atendimento retomado.') : textoDoMotivo(r.motivo)
        setMensagem(confirmacao + ' Atualize a página para conferir a situação atual.')
        try {
          if (!limparConfirmado(e)) return
          if (!r.ok) { setEstado('livre'); setEnvio(null); return }
          if (!r.leituraDestino.ok || r.leituraDestino.destino.tipo === 'indisponivel') { router.refresh(); return }
          const d = r.leituraDestino.destino
          if (d.tipo === 'atendimento') router.push(urlAtendimento(d.empresaId, contexto))
          if (d.tipo === 'funil') router.push('/funil?negociacao=' + encodeURIComponent(d.negociacaoId))
          if (d.tipo === 'carteira') router.push('/carteira/' + encodeURIComponent(d.empresaId))
          if (d.tipo === 'sem_interesse') router.push(urlPessoal({ ...contexto, disponibilidade: 'sem_interesse' }, 1))
        } catch { setMensagem(confirmacao + ' Atualize a página para conferir a situação atual.') }
      } catch { if (vivo.current) setMensagem('Não foi possível confirmar. Confirme a retomada anterior para reenviar o mesmo comando.') }
      finally { ocupado.current = false }
    })
  }
  function retomarNaConsulta(intencao: Intencao, contexto: FiltrosPessoais): boolean {
    if (ocupado.current || estado !== 'livre') return true
    try {
      const storage = PREFIXO_MODERNO + intencao.empresaId
      const salvo = sessionStorage.getItem(storage)
      if (salvo) {
        const c: unknown = JSON.parse(salvo)
        // Compatibilidade: sem metadado, o card mantém seu replay original.
        // Não gerar outra chave nem sobrescrever esse comando.
        if (!c || typeof c !== 'object' || !('usuarioId' in c)) return false
        if (c.usuarioId !== usuarioId) {
          setMensagem('Existe um envio de outra sessão para esta empresa. Atualize a página antes de continuar.')
          return true
        }
        if (!('tipo' in c) || c.tipo !== 'retomar') return false
      }
      const anterior = lerEnvios(usuarioId)[0]
      if (anterior) {
        setEnvio(anterior); setEstado('incerto'); setMensagem('Confirme a retomada anterior antes de retomar outra empresa.')
        return true
      }
      const comando = { id: intencao.empresaId, versao: intencao.versao, chave: crypto.randomUUID(), tipo: 'retomar', usuarioId }
      const registro = JSON.stringify(comando)
      sessionStorage.setItem(storage, registro)
      executar({ storage, comando, registro }, contexto)
    } catch { setMensagem('Não foi possível preparar a retomada. Confira o armazenamento desta aba antes de tentar novamente.') }
    return true
  }
  function atualizar() {
    try {
      if (envio && !limparConfirmado(envio)) return
      router.refresh(); setEnvio(null); setEstado('livre'); setMensagem('')
    } catch { setMensagem('Envio resolvido. Atualize a página para conferir a situação atual.') }
  }
  return <RetomadaNaConsulta.Provider value={retomarNaConsulta}><BloqueioRetomada.Provider value={estado !== 'livre'}>
    {mensagem && <section aria-label="Retomada anterior" aria-busy={pendente}>
      <p role="status">{mensagem}</p>
      {estado === 'incerto' && envio && <Button variant="outline" disabled={pendente} onClick={() => executar(envio, filtros)}>Confirmar retomada anterior</Button>}
      {estado === 'confirmado' && <Button variant="outline" onClick={atualizar}>Atualizar empresas</Button>}
    </section>}
    {children}
  </BloqueioRetomada.Provider></RetomadaNaConsulta.Provider>
}
