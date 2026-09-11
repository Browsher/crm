import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { NativeSelect } from '@/src/components/ui/native-select'
import type { FiltrosMeuDia } from './agenda'
import styles from './meu-dia.module.css'

export function FiltrosForm({ filtros }: { filtros: FiltrosMeuDia }) {
  return <form action="/meu-dia" method="get" className={styles.filtros}>
    <div><Label htmlFor="meu-dia-nome">Nome</Label><Input id="meu-dia-nome" name="nome" type="search"
      maxLength={120} defaultValue={filtros.nome} placeholder="Razão social ou nome fantasia" /></div>
    <div><Label htmlFor="meu-dia-retorno">Retorno</Label><NativeSelect id="meu-dia-retorno" name="retorno" defaultValue={filtros.retorno}>
      <option value="">Todos</option><option value="atrasado">Atrasados</option><option value="hoje">Hoje</option>
    </NativeSelect></div>
    <div className={styles.acoesFiltros}>
      <Button type="submit">Filtrar</Button>
      <Button asChild variant="ghost"><Link href="/meu-dia">Limpar filtros</Link></Button>
    </div>
  </form>
}
