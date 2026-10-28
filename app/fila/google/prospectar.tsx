'use client'
import { useActionState } from 'react'
import { Button } from '@/src/components/ui/button'
import { prospectarGoogleAcao } from './acoes'
export function ProspectarGoogle({ pedido, empresa, contexto }: { pedido: string; empresa: string; contexto: string | null }) {
  const [estado, acao, pendente] = useActionState(prospectarGoogleAcao, { erro: null })
  return <form action={acao}>
    <input name="pedido" type="hidden" value={pedido} /><input name="empresa" type="hidden" value={empresa} /><input name="contexto" type="hidden" value={contexto ?? ''} />
    <Button disabled={pendente}>{pendente ? 'Reservando…' : 'Prospectar'}</Button>
    {estado.erro && <p role="alert">{estado.erro}</p>}
  </form>
}
