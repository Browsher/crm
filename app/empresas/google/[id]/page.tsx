import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { DetalheEntrega } from '@/app/fila/google/entrega'
import styles from '@/app/fila/google/google.module.css'
export default async function PaginaEntregaGestor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('gestor')
  const { id } = await params
  const query = await searchParams
  const numero = typeof query.pagina === 'string' ? Number(query.pagina) : 1
  const pagina = Number.isInteger(numero) && numero >= 1 && numero <= 100 ? numero : 1
  const entrega = await repositorioGoogle(eu.usuarioId).detalhe(id, pagina)
  if (!entrega) notFound()
  return <main className={styles.pagina}><CabecalhoPagina titulo={entrega.plano.nicho} descricao={`Coleta solicitada por ${entrega.plano.vendedor}.`} acoes={<Button asChild variant="outline"><Link href={`/empresas/google?semana=${entrega.plano.dia}`}>Voltar para planejamentos</Link></Button>} />
    <DetalheEntrega {...entrega} gestor />
  </main>
}
