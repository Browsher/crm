import Link from 'next/link'
import { lerFiltros } from '@/src/features/prospeccao/filtros'
import { urlConsulta } from './navegacao'
import { consultarEmpresas, listarOpcoes } from '@/src/features/prospeccao/repositorio'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'
import { Resultados } from './resultados'
import { Paginacao } from './paginacao'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { listarRecentes, listarSugestoes } from '@/src/features/prospeccao/recentes'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PaginaLocalizar({ searchParams }: Props) {
  const eu = await exigir('usuario')
  const r = lerFiltros(await searchParams)
  if (!r.ok) return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Localizar empresa</h1>
      <p role="alert">Um dos filtros é inválido. Limpe os filtros e tente novamente.</p>
      <Link href="/fila/localizar" className="underline">Limpar filtros</Link>
    </main>
  )
  const filtros = r.filtros
  const temFiltro = Boolean(filtros.nome || filtros.cnae || filtros.uf || filtros.cidade || filtros.bairro)
  const opcoes = await listarOpcoes(eu.usuarioId, filtros.uf, filtros.cidade)
  const resultado = temFiltro && opcoes.ok ? await consultarEmpresas(eu.usuarioId, filtros) : null
  const recentes = !temFiltro && opcoes.ok ? await listarRecentes(eu.usuarioId) : null
  const sugerir = recentes?.ok && recentes.empresas.length === 0
  const inicial = sugerir ? await listarSugestoes(eu.usuarioId) : recentes
  const lista = resultado ?? inicial
  const minhas = lista?.ok ? await lerMinhasEmpresas(eu.usuarioId) : null
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Localizar empresa</h1>
        <Link href={urlConsulta(filtros, 1).replace('/fila/localizar', '/fila')} className="text-sm underline">Voltar para a fila</Link>
      </header>
      <p>Pesquise empresas e confira a disponibilidade para atendimento.</p>
      {opcoes.ok ? <Formulario key={JSON.stringify(filtros)} filtros={filtros} opcoes={opcoes.opcoes} />
        : <p role="alert">Você não tem permissão para consultar empresas.</p>}
      {inicial?.ok && <h2 className="text-lg font-semibold">{sugerir ? 'Sugestões de empresas' : 'Empresas recentes'}</h2>}
      {lista && (lista.ok ? <>
        <Resultados empresas={lista.empresas} filtros={filtros} reserva={minhas?.ok ? {contexto:minhas.contexto,filtros,empresaAtual:minhas.reserva?.id ?? null} : undefined} />
        {resultado?.ok && <Paginacao filtros={filtros} temProxima={resultado.temProxima} />}
      </> : <p role="alert">Você não tem permissão para consultar empresas.</p>)}
    </main>
  )
}
