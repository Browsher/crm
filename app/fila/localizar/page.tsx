import Link from 'next/link'
import { lerGrupoProspeccao, listarGruposProspeccao } from '@/src/server/grupos/prospeccao'
import { GruposProspeccao } from '../grupos'
import { ContextoGrupo } from './contexto-grupo'
import { mensagemConsulta } from '@/src/features/prospeccao/mensagens'
import { lerFiltros } from '@/src/features/prospeccao/filtros'
import { urlConsulta } from './navegacao'
import { consultarEmpresas, listarOpcoes } from '@/src/features/prospeccao/repositorio'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'
import { Resultados } from './resultados'
import { Paginacao } from './paginacao'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { listarRecentes, listarSugestoes } from '@/src/features/prospeccao/recentes'
import { EtapasFila } from '../etapas'
import { Reservar } from './reservar'
import styles from './localizar.module.css'
import { Button } from '@/src/components/ui/button'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PaginaLocalizar({ searchParams }: Props) {
  const eu = await exigir('vendedor')
  const params = await searchParams
  const r = lerFiltros(params)
  if (!r.ok) return (
    <main className={styles.pagina}>
      <h1>Começar a prospecção</h1>
      <p role="alert">Um dos filtros é inválido. Limpe os filtros e tente novamente.</p>
      <Link href="/fila/localizar?escolher_lista=1" className="underline">Todas as listas ativas</Link>
    </main>
  )
  const escolhendo = params.escolher_lista === '1'
  const paginaListas = lerFiltros({pagina:params.listas_pagina})
  const catalogo = escolhendo && paginaListas.ok ? await listarGruposProspeccao(eu.usuarioId,paginaListas.filtros.pagina) : null
  const filtros = r.filtros
  const grupo = filtros.grupo ? await lerGrupoProspeccao(eu.usuarioId,filtros.grupo) : null
  const temFiltro = Boolean(filtros.nome || filtros.cnae || filtros.uf || filtros.cidade || filtros.bairro || filtros.grupo)
  const opcoes = grupo && !grupo.ok ? grupo : await listarOpcoes(eu.usuarioId, filtros.uf, filtros.cidade, filtros.grupo)
  const resultado = temFiltro && opcoes.ok ? await consultarEmpresas(eu.usuarioId, filtros) : null
  const recentes = !temFiltro && opcoes.ok ? await listarRecentes(eu.usuarioId) : null
  const sugerir = recentes?.ok && recentes.empresas.length === 0
  const inicial = sugerir ? await listarSugestoes(eu.usuarioId) : recentes
  const lista = resultado ?? inicial
  const grupoIndisponivel = (!opcoes.ok && opcoes.motivo === 'grupo_indisponivel') || (resultado && !resultado.ok && resultado.motivo === 'grupo_indisponivel')
  const minhas = await lerMinhasEmpresas(eu.usuarioId)
  return (
    <main className={styles.pagina}>
      <EtapasFila etapa="puxar" filtros={filtros} />
      <header className={styles.cabecalho}>
        <h1>Começar a prospecção</h1>
        <p>Puxe a próxima empresa disponível. A reserva mantém o cliente com você enquanto registra a conversa.</p>
        {minhas?.ok && minhas.reserva && <Button asChild variant="outline" className={styles.acaoCabecalho}><Link href={urlConsulta(filtros, filtros.pagina).replace('/fila/localizar', '/fila')}>Voltar para a fila</Link></Button>}
      </header>
      <ContextoGrupo resultado={grupoIndisponivel ? {ok:false,motivo:'grupo_indisponivel'} : grupo} filtros={filtros} escolhendo={params.escolher_lista === '1'} />
      {escolhendo && (!paginaListas.ok ? <p role="alert">Página de listas inválida. Escolha uma página entre 1 e 10.000.</p>
        : catalogo?.ok ? <GruposProspeccao grupos={catalogo.grupos} pagina={paginaListas.filtros.pagina} temProxima={catalogo.temProxima} escolha={{filtros,atendimento:false}} />
        : <p role="alert">Você não tem permissão para consultar as listas.</p>)}
      <section className={styles.painel} aria-labelledby="titulo-localizar">
      <h2 id="titulo-localizar">Localizar empresa</h2>
      <p className={styles.ajuda}>Pesquise pelo nome ou refine os resultados pelos filtros.</p>
      {opcoes.ok ? <><Formulario key={JSON.stringify(filtros)} filtros={filtros} opcoes={opcoes.opcoes} />
        {minhas?.ok && <Reservar empresaId={null} contexto={minhas.contexto} filtros={filtros} empresaAtual={minhas.reserva?.id ?? null} />}</>
        : <p role="alert">{mensagemConsulta(opcoes.motivo)}</p>}
      </section>
      {inicial?.ok && <h2 className="text-lg font-semibold">{sugerir ? 'Sugestões de empresas' : 'Empresas recentes'}</h2>}
      {lista && (lista.ok ? <>
        <Resultados empresas={lista.empresas} filtros={filtros} reserva={minhas?.ok ? {contexto:minhas.contexto,filtros,empresaAtual:minhas.reserva?.id ?? null} : undefined} />
        {resultado?.ok && <Paginacao filtros={filtros} temProxima={resultado.temProxima} />}
      </> : <p role="alert">{mensagemConsulta(lista.motivo)}</p>)}
    </main>
  )
}
