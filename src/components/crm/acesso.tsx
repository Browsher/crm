import type { ReactNode } from 'react'
import { Columns3 } from 'lucide-react'
import styles from './acesso.module.css'

export function Acesso({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return <main className={`crm-ui ${styles.acesso}`}><aside className={styles.apresentacao}><div className={styles.marca}><Columns3 aria-hidden="true" />CRM</div><div><p className={styles.legenda}>Gestão comercial</p><h2>Mais clareza para o seu próximo contato.</h2><p>Prospecção, relacionamentos e oportunidades no mesmo lugar.</p></div><small>Sua rotina comercial, organizada.</small></aside><section className={styles.areaFormulario}><div className={styles.formulario}><p className={styles.identificador}>CRM · Gestão comercial</p><h1>{titulo}</h1><p className={styles.descricao}>{descricao}</p>{children}</div></section></main>
}
