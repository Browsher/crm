'use client'

import { useActionState } from 'react'
import type { LimiteBusca } from '@/src/features/busca-empresas/tipos'
import { Alert } from '@/src/components/ui/alert'
import { Choice } from '@/src/components/ui/choice'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { salvarLimiteAcao, type EstadoLimite } from './acoes'
import styles from '@/src/components/crm/busca-empresas.module.css'
const inicial: EstadoLimite = { erro: null, salvo: false }
export function FormularioLimite({ limite }: { limite: LimiteBusca }) {
  const [estado, acao, pendente] = useActionState(salvarLimiteAcao, inicial)
  return <form action={acao} aria-label={`Limite de ${limite.vendedor}`} className={styles.limite}>
    <input type="hidden" name="usuario" value={limite.usuario_id} />
    <div><strong>{limite.vendedor}</strong><p>{limite.usado} empresas solicitadas hoje</p></div>
    <label>Limite diário de {limite.vendedor}<Input name="limite" type="number" min={0} max={10000} defaultValue={limite.limite_diario} required disabled={pendente} /></label>
    <label className={styles.pausa}><Choice type="checkbox" name="pausado" defaultChecked={limite.pausado} disabled={pendente} />Pausar buscas de {limite.vendedor}</label>
    <Button type="submit" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar limite'}</Button>
    {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
    {estado.salvo && <Alert variant="success" role="status">Limite salvo.</Alert>}
  </form>
}
