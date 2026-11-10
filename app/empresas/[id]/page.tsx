import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Button } from '@/src/components/ui/button'
import { ConteudoFicha, IdentificacaoFicha } from './ficha'
import { lerFichaEmpresa } from './ficha-leitura'
import { navegacaoFicha, type ConsultaFicha } from './ficha-navegacao'
import styles from './perfil.module.css'

export default async function PaginaPerfil({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams?: Promise<ConsultaFicha>
}) {
  const eu = await exigir('gestor')
  const { id } = await params
  const ficha = await lerFichaEmpresa(eu.usuarioId, id)
  if (!ficha) notFound()
  const { voltar, origem, rotuloVolta, origemHistorico, abaInicial } = navegacaoFicha(ficha.empresa.situacao === 'arquivada', await searchParams ?? {})

  return <main className={styles.pagina}>
    <Button asChild variant="outline"><Link href={voltar} prefetch={origem?.tipo === 'whatsapp' ? false : undefined} className={styles.voltar}>{rotuloVolta}</Link></Button>
    <header><IdentificacaoFicha empresa={ficha.empresa}><p>Ficha da empresa</p><h1>{ficha.empresa.nome}</h1></IdentificacaoFicha></header>
    <ConteudoFicha ficha={ficha} abaInicial={abaInicial} origemHistorico={origemHistorico} />
  </main>
}
