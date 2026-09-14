import Link from 'next/link'
import { redirect } from 'next/navigation'
import { destinoCanonico, lerConsulta, totalDePaginas } from '@/src/features/empresas/consulta'
import { listarEmpresas } from '@/src/features/empresas/listagem'
import { textoDoMotivo } from '@/src/features/empresas/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Lista } from './lista'
import { Paginacao } from './paginacao'
import styles from './empresas.module.css'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PaginaEmpresas({ searchParams }: Props) {
  const eu = await exigir('gestor')
  const params = await searchParams
  // Antes de consultar: se a URL não está canônica, a ida ao banco seria
  // jogada fora pelo redirecionamento.
  const destino = destinoCanonico(params)
  if (destino) redirect(destino)
  const consulta = lerConsulta(params)
  const resultado = await listarEmpresas(eu.usuarioId, consulta)
  return (
    <main className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div><h1>Empresas</h1><p>Consulte os cadastros e importe novas empresas.</p></div>
        <Button asChild><Link href="/empresas/importar">Importar empresas</Link></Button>
      </header>
      {/* O formulário não carrega `pagina`: buscar volta para a primeira
          página, que é o que se espera de uma busca nova. */}
      <form action="/empresas" method="get" className={styles.busca}>
        <div className={styles.campo}><Label htmlFor="empresas-busca">Buscar empresas</Label><Input
          id="empresas-busca"
          type="search"
          name="q"
          defaultValue={consulta.termo}
          placeholder="Razão social, nome fantasia ou CNPJ"
        /></div>
        <Button type="submit">
          Buscar
        </Button>
        {consulta.termo && <Button asChild variant="ghost"><Link href="/empresas">Limpar busca</Link></Button>}
      </form>
      {resultado.ok ? (
        <>
          <p className={styles.contagem}>
            {resultado.total} {resultado.total === 1 ? 'empresa' : 'empresas'}
          </p>
          <Lista linhas={resultado.linhas} />
          <Paginacao pagina={consulta.pagina} paginas={totalDePaginas(resultado.total)} termo={consulta.termo} />
        </>
      ) : (
        <div role="alert" className={styles.vazio}><h2>Não foi possível consultar as empresas</h2><p>{textoDoMotivo(resultado.motivo)}</p><Link href="/empresas">Voltar para empresas</Link></div>
      )}
    </main>
  )
}
