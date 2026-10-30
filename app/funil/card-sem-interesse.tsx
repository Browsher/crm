'use client'
import Link from 'next/link'
import styles from './card-sem-interesse.module.css'

export type EstadoDescarte = 'repouso' | 'sobre' | 'salvando' | 'sucesso' | 'erro'
export function CardSemInteresse({ estado, total, aceitaArraste, aoMudarSobre, aoSoltar }: { estado: EstadoDescarte; total: number; aceitaArraste: boolean; aoMudarSobre: (sobre: boolean) => void; aoSoltar: () => void }) {
  return <aside data-descarte data-estado={estado} className={styles.card} aria-label="Sem interesse" aria-busy={estado === 'salvando'}
    onDragOver={e => { if (aceitaArraste) { e.preventDefault(); aoMudarSobre(true) } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) aoMudarSobre(false) }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); aoMudarSobre(false); if (aceitaArraste) aoSoltar() }}>
    <span className={styles.icone} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path className={styles.tampa} d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="m5 6 1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7m4-7v7"/></svg></span>
    <div><h2>Sem interesse <span>{total}</span></h2><p>{estado === 'salvando' ? 'Confirmando arquivamento...' : estado === 'sucesso' ? 'Empresa arquivada.' : 'Arraste uma empresa ou use a ação do card.'}</p></div>
    <Link href="/fila/sem-interesse" onDragStart={e => e.preventDefault()}>Consultar arquivo</Link>
  </aside>
}
