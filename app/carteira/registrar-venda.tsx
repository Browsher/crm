import type { FormEventHandler } from 'react'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import type { EntradaVenda } from '@/src/lib/venda-envio'

export function FormularioRecompra({ id, entrada, bloqueado, aoMudar, aoConferir }: {
  id: string
  entrada: EntradaVenda
  bloqueado: boolean
  aoMudar: (entrada: EntradaVenda) => void
  aoConferir: FormEventHandler<HTMLFormElement>
}) {
  return <form id={id} className="space-y-4" onSubmit={aoConferir}>
    <fieldset disabled={bloqueado} className="space-y-3">
      <label className="block space-y-1">Valor em reais
        <Input name="valor" inputMode="decimal" required value={entrada.valor} onChange={e => aoMudar({ ...entrada, valor: e.target.value })} placeholder="0,00" />
      </label>
      <label className="block space-y-1">Data da venda
        <Input name="data" type="date" required value={entrada.data} onChange={e => aoMudar({ ...entrada, data: e.target.value })} />
      </label>
      <label className="block space-y-1">Observação (opcional)
        <Textarea value={entrada.observacao} onChange={e => aoMudar({ ...entrada, observacao: e.target.value })} maxLength={2000} />
      </label>
    </fieldset>
    <p className="text-sm text-muted-foreground">Nesta versão, vendas não podem ser editadas nem excluídas. Confira os dados antes de confirmar.</p>
  </form>
}
