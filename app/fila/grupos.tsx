import Link from 'next/link'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import type { GrupoProspeccao } from '@/src/server/grupos/prospeccao'
import { Button } from '@/src/components/ui/button'
import { selecionarGrupo, urlConsulta, urlEscolhaLista } from './localizar/navegacao'
import styles from './grupos.module.css'

type Escolha = {filtros:Filtros;atendimento:boolean}
const dataImportacao=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'})
function urlPagina(pagina:number,escolha?:Escolha) {
  const destino=escolha ? urlEscolhaLista(escolha.filtros,escolha.atendimento,true) : '/fila'
  return `${destino}${destino.includes('?')?'&':'?'}listas_pagina=${pagina}`
}
export function GruposProspeccao({grupos,pagina,temProxima,escolha}: {
  grupos:GrupoProspeccao[];pagina:number;temProxima:boolean;escolha?:Escolha
}) {
  return <section aria-label="Listas de prospecção" className={styles.catalogo}>
    <header className={styles.cabecalho}>
      <h2>Escolha uma lista para prospectar</h2>
      <p>Confira como cada lista foi obtida e quantas empresas estão disponíveis para uma nova reserva.</p>
      {escolha && <Button asChild variant="outline"><Link href={urlConsulta(selecionarGrupo(null),1).replace('/fila/localizar',escolha.atendimento?'/fila':'/fila/localizar')}>Todas as listas ativas</Link></Button>}
    </header>
    <p className={styles.ajuda}>Estas são as listas compartilhadas antigas. Suas empresas do agente estão em Localizar empresas.</p>
    <Button asChild variant="outline"><Link href="/fila/localizar?origem=google">Consultar empresas do Google</Link></Button>
    {grupos.length ? <div className={styles.listas}>{grupos.map(grupo=> {
      const destino=urlConsulta(selecionarGrupo(grupo.id),1)
      return <article key={grupo.id} className={styles.cartao}>
        <header><h3>{grupo.nome}</h3>{grupo.descricao && <p className={styles.texto}>{grupo.descricao}</p>}</header>
        <div><h4>Origem</h4><p className={styles.texto}>{grupo.origem ?? 'Origem não informada'}</p></div>
        {grupo.googleLegado && <p className={styles.ajuda}>Lista compartilhada com empresas de origem Google. Consulte as novas entregas em Localizar empresas.</p>}
        <dl className={styles.dados}>
          <div><dt>Importada em</dt><dd><time dateTime={grupo.criadoEm}>{dataImportacao.format(new Date(grupo.criadoEm))}</time></dd></div>
          <div><dt>Empresas</dt><dd>{grupo.total}</dd></div>
          <div><dt>Disponíveis</dt><dd>{grupo.disponiveis}</dd></div>
        </dl>
        {grupo.criterios && <details className={styles.criterios}><summary>Critérios usados</summary><p className={styles.texto}>{grupo.criterios}</p></details>}
        {grupo.disponiveis===0 && <p className={styles.ajuda}>Nenhuma empresa disponível para nova reserva nesta lista agora. Empresas podem estar em atendimento, em carteira, em descanso ou ser clientes.</p>}
        <Button asChild variant="outline" className={styles.acao}><Link href={escolha?.atendimento?destino.replace('/fila/localizar','/fila'):destino}>Prospectar esta lista</Link></Button>
      </article>
    })}</div> : <div role="status"><h3>Nenhuma lista nesta página</h3><p>{pagina>1?'Volte à primeira página para consultar as listas ativas.':'Nenhuma lista ativa está disponível agora.'}</p>{pagina>1&&<Button asChild variant="outline"><Link href={urlPagina(1,escolha)}>Voltar à primeira página de listas</Link></Button>}</div>}
    <p className={styles.ajuda}>As contagens são por lista. A mesma empresa pode aparecer em mais de uma.</p>
    <nav aria-label="Páginas de listas" className={styles.paginacao}>
      {pagina>1&&<Button asChild variant="outline"><Link href={urlPagina(pagina-1,escolha)}>Página anterior de listas</Link></Button>}
      <span>Página de listas {pagina}</span>
      {temProxima&&pagina<10000&&<Button asChild variant="outline"><Link href={urlPagina(pagina+1,escolha)}>Próxima página de listas</Link></Button>}
    </nav>
  </section>
}
