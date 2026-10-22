import Link from 'next/link'
import { Alert } from '@/src/components/ui/alert'
import { EntradaSemReserva } from './entrada-sem-reserva'
import { lerHistorico } from '@/src/features/contato/historico'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'
import { lerFiltros } from '@/src/features/prospeccao/filtros'
import { selecionarGrupo, urlConsulta } from './localizar/navegacao'
import { lerGrupoProspeccao, listarGruposProspeccao } from '@/src/server/grupos/prospeccao'
import { GruposProspeccao } from './grupos'
import { ContextoGrupo } from './localizar/contexto-grupo'

export default async function PaginaFila({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const eu = await exigir('vendedor')
  const params = await searchParams
  const entrada = lerFiltros(params)
  const r = await lerMinhasEmpresas(eu.usuarioId)
  const escolhendo = params.escolher_lista === '1'
  const paginaListas = lerFiltros({pagina:params.listas_pagina})
  const mostrarCatalogo = r.ok && entrada.ok && (!r.reserva || escolhendo)
  const catalogo = mostrarCatalogo && paginaListas.ok ? await listarGruposProspeccao(eu.usuarioId,paginaListas.filtros.pagina) : null
  const filtros = entrada.ok ? entrada.filtros : selecionarGrupo(null)
  const grupo = entrada.ok && filtros.grupo ? await lerGrupoProspeccao(eu.usuarioId,filtros.grupo) : null
  // O histórico só é buscado quando há reserva: sem empresa na mão, não há
  // linha do tempo para mostrar, e a ida ao banco não se paga.
  const historico = r.ok && r.reserva ? await lerHistorico(eu.usuarioId, r.reserva.id) : null
  const contatos = historico?.ok ? historico.contatos : []
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{r.ok && r.reserva ? 'Atendimento' : 'Prospecção'}</h1>
        <nav className="flex items-center gap-3">
          <Link href="/fila/buscar" className="text-sm underline">Buscar empresas</Link>
          <Link href={urlConsulta(filtros,1)} className="text-sm underline">
            Localizar empresa
          </Link>
        </nav>
      </header>
      <div>
        {entrada.ok ? <ContextoGrupo resultado={grupo} filtros={filtros} atendimento escolhendo={params.escolher_lista === '1'} /> : <p role="alert">Filtros inválidos. A busca não foi executada. <Link href="/fila?escolher_lista=1">Todas as listas ativas</Link></p>}
      </div>
      <div>
      {r.ok ? (
        r.reserva ? <Formulario reserva={r.reserva} contatos={contatos} contexto={r.contexto} filtros={filtros} buscaBloqueada={!entrada.ok || Boolean(grupo && !grupo.ok)} />
          : entrada.ok ? <EntradaSemReserva contexto={r.contexto} filtros={filtros} /> : null
      ) : (
        <Alert variant="warning">{textoDoMotivo(r.motivo)}</Alert>
      )}
      </div>
      {/* Slot de catálogo da próxima busca: permanece depois do atendimento para preservar a instância do editor. */}
      <div data-escolher-lista={escolhendo ? 'aberto' : 'fechado'}>
        {mostrarCatalogo && (!paginaListas.ok ? <p role="alert">Página de listas inválida. Escolha uma página entre 1 e 10.000.</p>
          : catalogo?.ok ? <GruposProspeccao grupos={catalogo.grupos} pagina={paginaListas.filtros.pagina} temProxima={catalogo.temProxima}
              escolha={r.ok && r.reserva || escolhendo ? {filtros,atendimento:r.ok && Boolean(r.reserva)} : undefined} />
          : <p role="alert">Você não tem permissão para consultar as listas.</p>)}
      </div>
    </main>
  )
}
