'use client'

import { useActionState } from 'react'
import { Alert } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { definirAgenteAcao } from './acoes'
import styles from '@/app/fila/google/google.module.css'

export function ControleAgente({vendedor,pausado,disponivel}: {vendedor:string;pausado:boolean;disponivel:boolean}) {
  const [estado,acao,pendente] = useActionState(definirAgenteAcao,{erro:null})
  return <form action={acao} className={styles.sincronizar}>
    <input type="hidden" name="vendedor" value={vendedor} />
    <input type="hidden" name="pausado" value={String(!pausado)} />
    <Button variant="outline" disabled={pendente || !disponivel}>{pendente?'Atualizando…':pausado?'Retomar novas buscas':'Pausar novas buscas'}</Button>
    {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
    {estado.sucesso && <Alert role="status" variant="success">Agente atualizado.</Alert>}
  </form>
}
