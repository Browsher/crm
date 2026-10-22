import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { DetalheEntrega } from '../entrega'
import styles from '../google.module.css'
export default async function PaginaEntrega({ params }: { params: Promise<{ id: string }> }) {
  const eu = await exigir('vendedor')
  const { id } = await params
  const entrega = await repositorioGoogle(eu.usuarioId).detalhe(id)
  if (!entrega) notFound()
  const minhas = await lerMinhasEmpresas(eu.usuarioId)
  return <main className={styles.pagina}><CabecalhoPagina titulo={entrega.plano.nicho} descricao="Leads recebidos pelo agente do Google." acoes={<Button asChild variant="outline"><Link href={`/fila/google?semana=${entrega.plano.dia}&aba=entregas`}>Voltar para leads recebidos</Link></Button>} />
    <DetalheEntrega {...entrega} contexto={minhas.ok ? minhas.contexto : null} />
  </main>
}
