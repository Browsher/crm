'use client'
import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { prepararContatoAcao, registrarContatoAcao, type EstadoContato } from './acao'
import { ROTULO, TIPOS_CONTATO, type TipoContato } from './tipos'
import { prepararEnvio, rascunhoInicial, type EnvioContato, type RascunhoContato } from './rascunho'
import { Button } from '@/src/components/ui/button'
import { Choice } from '@/src/components/ui/choice'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Textarea } from '@/src/components/ui/textarea'
import { Alert } from '@/src/components/ui/alert'

type Props = {
  empresaId: string; posse?: boolean; comDevolver?: boolean; tipoInicial?: TipoContato; voltarPara?: string
  versao?: number; fase?: 'inicial' | 'negociacao' | 'cliente'
  somenteConfirmacao?: boolean
  rascunho?: RascunhoContato; onDraftChange?: (valor: RascunhoContato) => void
  onSaved?: (empresaId: string) => void; bloqueado?: boolean; somenteLeitura?: boolean
  onPendingChange?: (valor: boolean) => void; visual?: 'fila'
}
const INICIAL: EstadoContato = { erro: null, ok: false }
function assinarSessao(avisar: () => void) {
  window.addEventListener('crm-contato', avisar)
  return () => window.removeEventListener('crm-contato', avisar)
}
function lerSessao(chave: string) {
  try { return sessionStorage.getItem(chave) ?? '{}' } catch { return '!erro' }
}
function decodificarSessao(bruto: string | null): { valor?: RascunhoContato; envio?: EnvioContato | null; erro?: boolean } {
  if (bruto === null) return {}
  try {
    const dados = JSON.parse(bruto)
    if (!dados || typeof dados !== 'object') return { erro: true }
    if (dados.valor && (!TIPOS_CONTATO.includes(dados.valor.tipo) || ['nota','proximoPasso','proximoPassoData'].some(k => typeof dados.valor[k] !== 'string'))) return { erro: true }
    if (dados.envio && (!dados.envio.chave || !Number.isInteger(dados.envio.versao) || !dados.envio.valor)) return { erro: true }
    return dados
  } catch { return { erro: true } }
}
// A chave e a entrada ficam na sessão da aba ANTES da chamada. Recarregar a página
// não transforma uma resposta perdida em outro comando nem sincroniza uma aba antiga.
export function FormularioContato(props: Props) { return <EditorContato key={props.empresaId} {...props} /> }
function EditorContato({ empresaId, tipoInicial, versao, fase, somenteConfirmacao = false, rascunho, onDraftChange, onSaved, bloqueado = false, somenteLeitura = false, onPendingChange, visual }: Props) {
  const camposId = useId()
  const router = useRouter()
  const chaveStorage = 'crm:contato:v1:' + empresaId
  const [interno, setInterno] = useState<RascunhoContato>(() => ({ ...rascunhoInicial(false), tipo: tipoInicial ?? 'nao_liguei' }))
  const [preparado, setPreparado] = useState<{ versao: number; fase: NonNullable<Props['fase']> } | null>(() => versao && fase ? { versao, fase } : null)
  const snapshot = useSyncExternalStore(assinarSessao, () => lerSessao(chaveStorage), () => null)
  const sessao = decodificarSessao(snapshot)
  const envio = sessao.envio ?? null
  const carregado = snapshot !== null && !sessao.erro
  const [erroPreparacao, setErroPreparacao] = useState('')
  const atual = sessao.valor ?? rascunho ?? interno
  const notificado = useRef<string | null>(null)
  useEffect(() => {
    if (notificado.current === snapshot) return
    notificado.current = snapshot
    const restaurado = decodificarSessao(snapshot).valor
    if (restaurado) onDraftChange?.(restaurado)
  }, [snapshot, onDraftChange])
  useEffect(() => {
    let ativo = true
    if (!versao || !fase) prepararContatoAcao(empresaId).then(r => {
      if (!ativo) return
      if (r.ok && r.empresa.versao && !['sem_interesse','indisponivel'].includes(r.empresa.situacao)) setPreparado({ versao: r.empresa.versao, fase: r.fase })
      else setErroPreparacao('Esta empresa não está disponível para registro.')
    }, () => { if (ativo) setErroPreparacao('Não foi possível preparar o atendimento. Recarregue para tentar novamente.') })
    return () => { ativo = false }
    // A leitura é da abertura do editor; revalidação não atualiza a versão de uma aba antiga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])
  function salvar(valor: RascunhoContato, comando: EnvioContato | null) {
    sessionStorage.setItem(chaveStorage, JSON.stringify({ valor, envio: comando }))
    window.dispatchEvent(new Event('crm-contato'))
  }
  function limpar() {
    sessionStorage.removeItem(chaveStorage)
    window.dispatchEvent(new Event('crm-contato'))
  }
  function alterar(mudanca: Partial<RascunhoContato>) {
    const proximo = { ...atual, ...mudanca }
    salvar(proximo, envio); setInterno(proximo); onDraftChange?.(proximo)
  }
  const [estado, agir, pendente] = useActionState(async (): Promise<EstadoContato> => {
    if (bloqueado || !carregado || !envio && (somenteConfirmacao || !preparado)) return { ok: false, erro: 'Aguarde a preparação do atendimento.' }
    onPendingChange?.(true)
    try {
      const comando = envio ?? prepararEnvio(null, preparado!.versao, atual)
      salvar(atual, comando)
      const form = new FormData()
      form.set('id', empresaId); form.set('chave', comando.chave); form.set('versao', String(comando.versao))
      for (const [campo, valor] of Object.entries(comando.valor)) form.set(campo, valor)
      const r = await registrarContatoAcao(INICIAL, form)
      if (r.ok) {
        limpar()
        setInterno(rascunhoInicial(false)); onDraftChange?.(rascunhoInicial(false))
        setPreparado(null); router.refresh(); onSaved?.(empresaId)
        try {
          const novo = await prepararContatoAcao(empresaId)
          if (novo.ok && novo.empresa.versao && !['sem_interesse','indisponivel'].includes(novo.empresa.situacao)) setPreparado({ versao: novo.empresa.versao, fase: novo.fase })
        } catch { setErroPreparacao('O envio foi confirmado. Recarregue para preparar outro atendimento.') }
      } else if (r.motivo && !['sem_permissao','nao_encontrada'].includes(r.motivo)) {
        salvar(atual, { ...comando, resolvido: true })
      }
      return r
    } catch (erro) {
      return { ok: false, erro: erro instanceof Error && erro.message.includes('envio anterior') ? erro.message : 'Não foi possível confirmar o envio. Suas anotações foram preservadas. Tente novamente com os mesmos dados.' }
    } finally { onPendingChange?.(false) }
  }, INICIAL)
  const congelado = pendente || somenteLeitura || Boolean(envio && !envio.resolvido)
  const oferecidos = TIPOS_CONTATO.filter(t => t !== 'acompanhamento' || preparado?.fase !== 'inicial' && preparado !== null)
  if (somenteConfirmacao && !envio) return null
  return <form data-visual={visual} action={agir} onSubmit={e => { if (pendente || bloqueado) e.preventDefault() }} className="flex flex-col gap-4">
    <input type="hidden" name="id" value={empresaId} />
    {(estado.erro || erroPreparacao || sessao.erro) && <Alert variant="danger">{estado.erro || erroPreparacao || 'Não foi possível recuperar as anotações desta aba.'}</Alert>}
    {estado.ok && <p role="status">{estado.repetida ? 'Envio anterior confirmado. Dados atualizados.' : 'Atendimento registrado.'}</p>}
    <fieldset className="grid gap-2"><legend className="text-sm font-medium">O que aconteceu na ligação</legend>{oferecidos.map(t => <label key={t} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"><Choice type="radio" name="tipo" value={t} disabled={congelado} checked={atual.tipo === t} onChange={() => alterar({ tipo: t })} />{ROTULO[t]}</label>)}</fieldset>
    <Label htmlFor={camposId + '-nota'}>Nota</Label><Textarea id={camposId + '-nota'} name="nota" rows={3} maxLength={2000} readOnly={congelado} value={atual.nota} onChange={e => alterar({ nota: e.target.value })} />
    <label>Próximo passo<Input name="proximoPasso" value={atual.proximoPasso} maxLength={2000} readOnly={congelado} onChange={e => alterar({ proximoPasso: e.target.value })} /></label>
    <label>Data do próximo passo<Input type="date" name="proximoPassoData" value={atual.proximoPassoData} readOnly={congelado} onChange={e => alterar({ proximoPassoData: e.target.value })} /></label>
    {atual.tipo === 'sem_interesse' && <p>Sem interesse encerra a negociação e cancela os próximos passos.</p>}
    {(atual.tipo === 'interessado' || atual.tipo === 'retornar_depois') && <p>A empresa segue no seu Funil.</p>}
    <Button type="submit" className="self-start" disabled={pendente || bloqueado || !envio && !preparado || !carregado || Boolean(envio?.resolvido)}>{pendente ? 'Registrando…' : envio && !envio.resolvido ? 'Confirmar envio anterior' : 'Registrar'}</Button>
    {!envio && <Button type="button" variant="ghost" disabled={pendente} onClick={() => { limpar(); setInterno(rascunhoInicial(false)); onDraftChange?.(rascunhoInicial(false)) }}>Descartar anotações</Button>}
    {envio?.resolvido && <Button type="button" variant="outline" onClick={async () => {
      const r = await prepararContatoAcao(empresaId)
      if (!r.ok || !r.empresa.versao || ['sem_interesse','indisponivel'].includes(r.empresa.situacao)) { setErroPreparacao('Esta empresa não está disponível para registro.'); return }
      salvar(atual, null); setPreparado({ versao: r.empresa.versao, fase: r.fase }); router.refresh()
    }}>Atualizar atendimento para novo envio</Button>}
  </form>
}
