import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { lerResumosEmpresas } from '@/src/server/atendimento/consulta'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { DetalheEntrega } from '../entrega'
import styles from '../google.module.css'
export default async function PaginaEntrega({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const { id } = await params
  const query = await searchParams
  const numero = typeof query.pagina === 'string' ? Number(query.pagina) : 1
  const pagina = Number.isInteger(numero) && numero >= 1 && numero <= 100 ? numero : 1
  const entrega = await repositorioGoogle(eu.usuarioId).detalhe(id, pagina)
  if (!entrega) notFound()
  const resumos = await lerResumosEmpresas(eu.usuarioId, entrega.resultados.flatMap(r => r.empresa_id ? [r.empresa_id] : []))
  return <main className={styles.pagina}><CabecalhoPagina titulo={entrega.execucao?.snapshot?.nicho ?? entrega.plano.snapshot?.nicho ?? entrega.plano.nicho} descricao="Empresas recebidas pelas buscas no Google." acoes={<Button asChild variant="outline"><Link href={`/fila/google?semana=${entrega.plano.dia}&aba=entregas`}>Voltar para empresas recebidas</Link></Button>} />
    <DetalheEntrega {...entrega} empresas={resumos.ok ? resumos.empresas : []} />
  </main>
}
