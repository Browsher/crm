import Link from 'next/link'
import { CalendarDays, Building2, Search } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { NativeSelect } from '@/src/components/ui/native-select'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import styles from './central.module.css'

export function CentralProspeccao(_props: {atendimento?:string|null} = {}) {
  void _props
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Prospecção" descricao="Escolha o que você quer fazer." />
    <section aria-label="Atividades de Prospecção" className={styles.atividades}>
      <article className={styles.destaque}>
        <div className={styles.apresentacao}><span className={styles.icone}><Search aria-hidden="true" /></span><div><h2>Localizar empresas</h2><p>Escolha a origem das empresas. Depois, filtre por nicho e bairro para continuar os atendimentos.</p></div></div>
        <form action="/fila/localizar" className={styles.buscaOrigem}>
          <label>Origem das empresas<NativeSelect name="origem" defaultValue=""><option value="">Google e banco de empresas</option><option value="google">Buscas no Google</option><option value="banco">Banco de empresas</option></NativeSelect></label>
          <Button type="submit">Localizar empresas</Button>
        </form>
      </article>
      <div className={styles.opcoes}>
        <article className={styles.opcao}><CalendarDays aria-hidden="true" /><div><h2>Buscas no Google</h2><p>Defina o nicho e a região de cada dia. O agente entrega as empresas nos seus grupos.</p></div><Button asChild variant="outline"><Link href="/fila/google">Planejar buscas</Link></Button></article>
        <article className={styles.opcao}><Building2 aria-hidden="true" /><div><h2>Banco de empresas</h2><p>Encontre novas empresas e adicione as selecionadas aos seus grupos.</p></div><Button asChild variant="outline"><Link href="/fila/buscar?fonte=banco">Buscar novas empresas</Link></Button></article>
      </div>

    </section>
  </main>
}
