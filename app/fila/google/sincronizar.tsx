'use client'

import { useActionState } from 'react'
import { Button } from '@/src/components/ui/button'
import { sincronizarPlanoAcao } from './acoes'
import styles from './google.module.css'

export function SincronizarPlanejamento({pedido}: {pedido:string}) {
  const [estado,acao,pendente] = useActionState(sincronizarPlanoAcao,{erro:null})
  return <form action={acao} className={styles.sincronizar}>
    <input type="hidden" name="pedido" value={pedido} />
    <Button type="submit" variant="outline" size="sm" disabled={pendente}>{pendente?'Conferindo planilha…':'Sincronizar novamente'}</Button>
    {estado.erro && <p role="alert">{estado.erro}</p>}
    {estado.sucesso && <p role="status">Sincronizado com a planilha.</p>}
  </form>
}
