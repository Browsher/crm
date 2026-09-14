import Link from 'next/link'
import styles from './grupos.module.css'

export function dataGrupo(valor: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(valor))
}
export function SituacaoGrupo({ ativo }: { ativo: boolean }) {
  return <span className={ativo ? styles.ativo : styles.desativado}>{ativo ? 'Ativo' : 'Desativado'}</span>
}
export function PaginacaoGrupos({ pagina, total, caminho, gruposPagina }: { pagina: number; total: number; caminho: string; gruposPagina?: number }) {
  const paginas = Math.max(1, Math.ceil(total / 50))
  if (paginas === 1 && pagina === 1) return null
  const endereco = (n: number) => `${caminho}?pagina=${n}${gruposPagina ? `&gruposPagina=${gruposPagina}` : ''}`
  return <nav aria-label="Paginação" className={styles.paginacao}>
    {pagina > 1 ? <Link href={endereco(Math.min(pagina - 1, paginas))}>Anterior</Link> : <span aria-disabled="true">Anterior</span>}
    <span>Página {pagina} de {paginas}</span>
    {pagina < paginas ? <Link href={endereco(pagina + 1)}>Próxima</Link> : <span aria-disabled="true">Próxima</span>}
  </nav>
}
