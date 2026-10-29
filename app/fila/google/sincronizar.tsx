'use client'

import { useActionState } from 'react'
import { Alert } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { sincronizarPlanoAcao } from './acoes'
import styles from './google.module.css'

export function SincronizarPlanejamento({pedido,onSucesso}: {pedido:string;onSucesso?:()=>void}) {
  const [estado,acao,pendente] = useActionState(async (anterior:{erro:string|null},form:FormData) => {
    const resultado=await sincronizarPlanoAcao(anterior,form)
    if(resultado.sucesso) onSucesso?.()
    return resultado
  },{erro:null})
  return <form action={acao} className={styles.sincronizar}>
    <input type="hidden" name="pedido" value={pedido} />
    <Button type="submit" variant="outline" size="sm" disabled={pendente}>{pendente?'Conferindo planilha…':'Sincronizar novamente'}</Button>
    {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
    {estado.sucesso && !onSucesso && <Alert role="status" variant="success">Sincronizado com a planilha.</Alert>}
  </form>
}
