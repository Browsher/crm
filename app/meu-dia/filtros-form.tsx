import Link from 'next/link'
import Form from 'next/form'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { NativeSelect } from '@/src/components/ui/native-select'
import type { FiltrosMeuDia } from './agenda'
import { PainelFiltros } from '@/src/components/crm/painel-filtros'

export function FiltrosForm({ filtros }: { filtros: FiltrosMeuDia }) {
  return <Form key={JSON.stringify(filtros)} action="/meu-dia">
    <PainelFiltros acoes={<>
      <Button type="submit">Filtrar</Button>
      <Button asChild variant="ghost"><Link href="/meu-dia">Limpar filtros</Link></Button>
    </>}>
    <div><Label htmlFor="meu-dia-nome">Nome</Label><Input id="meu-dia-nome" name="nome" type="search"
      maxLength={120} defaultValue={filtros.nome} placeholder="Razão social ou nome fantasia" /></div>
    <div><Label htmlFor="meu-dia-retorno">Retorno</Label><NativeSelect id="meu-dia-retorno" name="retorno" defaultValue={filtros.retorno}>
      <option value="">Todos</option><option value="atrasado">Atrasos</option><option value="hoje">Hoje</option><option value="proximos">Próximos</option>
    </NativeSelect></div>
    <div><Label htmlFor="meu-dia-periodo">Período de próximos</Label><NativeSelect id="meu-dia-periodo" name="periodo" defaultValue={filtros.periodo}>
      <option value="">Todos os próximos</option><option value="amanha">Amanhã</option>
      <option value="semana_que_vem">Semana que vem</option><option value="mes_que_vem">Mês que vem</option>
    </NativeSelect></div>
    </PainelFiltros>
  </Form>
}
