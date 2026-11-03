'use client'

import { startTransition, useActionState, useState } from 'react'
import { useDescarteEdicao } from '@/src/components/crm/descarte-edicao'
import { RESULTADO_INCERTO } from '@/src/lib/edicao-administrativa'
import type { LimiteBusca } from '@/src/features/busca-empresas/tipos'
import { Alert } from '@/src/components/ui/alert'
import { Choice } from '@/src/components/ui/choice'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { salvarLimiteAcao, type EstadoLimite } from './acoes'
import styles from '@/src/components/crm/busca-empresas.module.css'
const inicial: EstadoLimite = { erro: null, salvo: false }
export function FormularioLimite({ limite }: { limite: LimiteBusca }) {
  const persistido = { valor: String(limite.limite_diario), pausado: limite.pausado }
  const [salvoLocal, setSalvoLocal] = useState<typeof persistido | null>(null)
  const salvo = salvoLocal ?? persistido
  const [edicao, setEdicao] = useState<typeof persistido | null>(null)
  const valores = edicao ?? salvo
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoLimite, form: FormData) => {
    const resultado = await salvarLimiteAcao(anterior, form)
      .catch(() => ({ erro: RESULTADO_INCERTO, salvo: false, incerto: true } satisfies EstadoLimite))
    if (resultado.salvo) {
      setSalvoLocal({ valor: String(Number(form.get('limite'))), pausado: form.get('pausado') === 'on' })
      setEdicao(null)
    }
    return resultado
  }, inicial)
  const alterado = valores.valor !== salvo.valor || valores.pausado !== salvo.pausado
  const { pedir, confirmacao } = useDescarteEdicao(alterado, pendente)
  const cancelar = () => pedir(() => setEdicao(null))
  return <><form action={acao} aria-label={`Limite de ${limite.vendedor}`} className={styles.limite} onSubmit={e => {
    e.preventDefault()
    if (pendente || estado.incerto) return
    const dados = new FormData(e.currentTarget)
    startTransition(() => acao(dados))
  }} onKeyDown={e => {
    if (alterado && e.key === 'Escape') { e.preventDefault(); cancelar() }
  }}>
    <input type="hidden" name="usuario" value={limite.usuario_id} />
    <div><strong>{limite.vendedor}</strong><p>{limite.usado} empresas solicitadas hoje</p></div>
    <label>Limite diário de {limite.vendedor}<Input name="limite" type="number" min={0} max={10000} value={valores.valor} onChange={e => setEdicao({ ...valores, valor: e.target.value })} required disabled={pendente} /></label>
    <label className={styles.pausa}><Choice type="checkbox" name="pausado" checked={valores.pausado} onChange={e => setEdicao({ ...valores, pausado: e.target.checked })} disabled={pendente} />Pausar buscas de {limite.vendedor}</label>
    {alterado && <Button type="button" variant="outline" disabled={pendente} onClick={cancelar}>Cancelar</Button>}
    <Button type="submit" disabled={pendente || estado.incerto}>{pendente ? 'Salvando…' : 'Salvar limite'}</Button>
    {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
    {estado.salvo && <Alert variant="success" role="status">{estado.aviso ?? 'Limite salvo.'}</Alert>}
  </form>{confirmacao}</>
}
