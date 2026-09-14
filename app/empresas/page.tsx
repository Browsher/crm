import Link from 'next/link'
import { redirect } from 'next/navigation'
import { aplicarFiltrosEmpresas, destinoCanonico, lerConsulta, totalDePaginas } from '@/src/features/empresas/consulta'
import { lerFiltrosEmpresas } from '@/src/features/empresas/filtros'
import { listarEmpresas, listarOpcoesEmpresas } from '@/src/features/empresas/listagem'
import { textoDoMotivo } from '@/src/features/empresas/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Button } from '@/src/components/ui/button'
import { Formulario } from './formulario'
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
  const filtros = lerFiltrosEmpresas(params)
  if (!filtros.ok) {
    return (
      <main className={styles.pagina}>
        <header className={styles.cabecalho}>
          <div><h1>Empresas</h1><p>Consulte os cadastros e importe novas empresas.</p></div>
          <div className={styles.acoesFiltros}><Button variant="outline" asChild><Link href="/empresas/grupos">Grupos de importação</Link></Button><Button asChild><Link href="/empresas/importar">Importar empresas</Link></Button></div>
        </header>
        <div role="alert" className={styles.vazio}>
          <h2>Não foi possível aplicar os filtros</h2>
          <p>Revise os filtros informados e tente novamente.</p>
          <Link href="/empresas">Limpar filtros</Link>
        </div>
      </main>
    )
  }
  const consulta = aplicarFiltrosEmpresas(lerConsulta(params), filtros.filtros)
  const [resultado, resultadoOpcoes] = await Promise.all([
    listarEmpresas(eu.usuarioId, consulta),
    listarOpcoesEmpresas(eu.usuarioId, consulta.uf, consulta.cidade),
  ])
  return (
    <main className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div><h1>Empresas</h1><p>Consulte os cadastros e importe novas empresas.</p></div>
        <div className={styles.acoesFiltros}><Button variant="outline" asChild><Link href="/empresas/grupos">Grupos de importação</Link></Button><Button asChild><Link href="/empresas/importar">Importar empresas</Link></Button></div>
      </header>
      {resultadoOpcoes.ok ? <Formulario consulta={consulta} opcoes={resultadoOpcoes.opcoes} /> : (
        <div role="alert" className={styles.vazio}><p>{textoDoMotivo(resultadoOpcoes.motivo)}</p></div>
      )}
      {!resultado.ok ? (
        <div role="alert" className={styles.vazio}><h2>Não foi possível consultar as empresas</h2><p>{textoDoMotivo(resultado.motivo)}</p><Link href="/empresas">Voltar para empresas</Link></div>
      ) : resultadoOpcoes.ok ? (
        <>
          <p className={styles.contagem}>
            {resultado.total} {resultado.total === 1 ? 'empresa' : 'empresas'}
          </p>
          <Lista linhas={resultado.linhas} />
          <Paginacao consulta={consulta} paginas={totalDePaginas(resultado.total)} />
        </>
      ) : null}
    </main>
  )
}
