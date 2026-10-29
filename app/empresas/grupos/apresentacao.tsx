import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import styles from './grupos.module.css'

export function dataGrupo(valor: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(valor))
}
export function SituacaoGrupo({ ativo }: { ativo: boolean }) {
  return <Badge variant={ativo ? 'success' : 'outline'}>{ativo ? 'Ativo' : 'Desativado'}</Badge>
}
export function PaginacaoGrupos({ pagina, total, caminho, gruposPagina }: { pagina: number; total: number; caminho: string; gruposPagina?: number }) {
  const paginas = Math.max(1, Math.ceil(total / 50))
  if (paginas === 1 && pagina === 1) return null
  const endereco = (n: number) => `${caminho}?pagina=${n}${gruposPagina ? `&gruposPagina=${gruposPagina}` : ''}`
  return <nav aria-label="Paginação" className={styles.paginacao}>
    {pagina > 1 ? <Button asChild variant="outline"><Link href={endereco(Math.min(pagina - 1, paginas))}>Anterior</Link></Button> : <Button variant="outline" disabled>Anterior</Button>}
    <span>Página {pagina} de {paginas}</span>
    {pagina < paginas ? <Button asChild variant="outline"><Link href={endereco(pagina + 1)}>Próxima</Link></Button> : <Button variant="outline" disabled>Próxima</Button>}
  </nav>
}
