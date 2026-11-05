import { exigir } from '@/src/server/autenticacao/guarda'
import { lerFunil, contarSemInteresse, lerEmpresaArquivadaDaNegociacao, listarSemInteresseFunil } from '@/src/features/funil/consulta'
import { empresaArquivada } from '@/src/components/crm/empresa-arquivada'
import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { Quadro } from './quadro'
import styles from './funil.module.css'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'

export default async function PaginaFunil({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const [linhas, total, arquivos, params] = await Promise.all([
    lerFunil(eu.usuarioId), contarSemInteresse(eu.usuarioId), listarSemInteresseFunil(eu.usuarioId), searchParams,
  ])
  const inicial = typeof params.negociacao === 'string' ? params.negociacao : null
  if (inicial) {
    const empresaId = await lerEmpresaArquivadaDaNegociacao(eu.usuarioId, inicial)
    const arquivo = empresaId ? await empresaArquivada(eu.usuarioId, empresaId) : null
    if (arquivo) return <main className={styles.pagina}>
      <Button asChild variant="outline"><Link href="/funil">Voltar para o Funil</Link></Button>{arquivo}
    </main>
  }
  return <main className={styles.pagina}>{total.ok
    ? <Quadro usuarioId={eu.usuarioId} linhas={linhas} arquivos={arquivos} negociacaoInicial={inicial}/>
    : <><CabecalhoPagina titulo="Funil comercial" descricao="Acompanhe suas negociações até a primeira venda."/><p role="alert">Você não tem permissão para consultar o Funil.</p></>}
  </main>
}
