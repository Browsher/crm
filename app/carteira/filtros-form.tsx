import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { NativeSelect } from '@/src/components/ui/native-select'
import type { FiltrosCarteira } from './filtros'
import styles from './carteira.module.css'

export function FiltrosForm({ filtros, ufs }: { filtros: FiltrosCarteira; ufs: string[] }) {
  const estados = [...new Set(ufs)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return <form action="/carteira" method="get" className={styles.filtros}>
    <div><Label htmlFor="carteira-nome">Nome</Label><Input id="carteira-nome" name="nome" type="search"
      maxLength={120} defaultValue={filtros.nome} placeholder="Razão social ou nome fantasia" /></div>
    <div><Label htmlFor="carteira-uf">UF</Label><NativeSelect id="carteira-uf" name="uf" defaultValue={filtros.uf}>
      <option value="">Todos</option>{estados.map(uf => <option key={uf} value={uf}>{uf}</option>)}
    </NativeSelect></div>
    <div><Label htmlFor="carteira-retorno">Retorno</Label><NativeSelect id="carteira-retorno" name="retorno" defaultValue={filtros.retorno}>
      <option value="">Todos</option><option value="atrasado">Atrasados</option><option value="hoje">Hoje</option>
      <option value="futuro">Próximos</option><option value="sem_data">Sem agendamento</option>
    </NativeSelect></div>
    <div className={styles.acoesFiltros}>
      <Button type="submit">Filtrar</Button>
      <Button asChild variant="ghost"><Link href="/carteira">Limpar filtros</Link></Button>
    </div>
  </form>
}
