import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import styles from './busca-empresas.module.css'
export function FontesBusca({ google }: { google: boolean }) {
  return <nav className={styles.fontes} aria-label="Origem das empresas">
    <Button asChild variant={google ? 'secondary' : 'ghost'}><Link href="/fila/buscar?fonte=google" aria-current={google ? 'page' : undefined}>Busca no Google</Link></Button>
    <Button asChild variant={!google ? 'secondary' : 'ghost'}><Link href="/fila/buscar?fonte=banco" aria-current={!google ? 'page' : undefined}>Busca do banco de dados</Link></Button>
  </nav>
}
