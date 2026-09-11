'use client'

import type { ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Filtros, OpcoesFiltro } from '@/src/features/prospeccao/tipos'

const campos = [
  { nome: 'cnae', label: 'CNAE' },
  { nome: 'uf', label: 'Estado' },
  { nome: 'cidade', label: 'Cidade' },
  { nome: 'bairro', label: 'Bairro' },
] as const

function atualizarDependentes(evento: ChangeEvent<HTMLSelectElement>) {
  const select = evento.currentTarget
  const form = select.form
  if (!form || !['uf', 'cidade'].includes(select.name)) return
  const limpar = select.name === 'uf' ? ['cidade', 'bairro'] : ['bairro']
  for (const nome of limpar) {
    const campo = form.elements.namedItem(nome)
    if (campo instanceof HTMLSelectElement) campo.value = ''
  }
  form.requestSubmit()
}

export function Formulario({ filtros, opcoes }: { filtros: Filtros; opcoes: OpcoesFiltro[] }) {
  const router = useRouter()
  return (
    <form action="/fila/localizar" method="get" onSubmit={e => {
      e.preventDefault()
      const params = new URLSearchParams()
      new FormData(e.currentTarget).forEach((valor,chave) => params.set(chave,String(valor)))
      router.push(`/fila/localizar?${params}`)
    }} className="flex flex-col gap-4 rounded border p-4">
      <label className="flex flex-col gap-1 text-sm">
        Nome
        <input name="nome" type="search" maxLength={100} defaultValue={filtros.nome}
          placeholder="Razão social ou nome fantasia" className="min-w-0 rounded border px-3 py-2" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map(({ nome, label }) => (
          <div key={nome} className="flex min-w-0 flex-col gap-1 text-sm">
            <label htmlFor={`filtro-${nome}`}>{label}</label>
            <select id={`filtro-${nome}`} name={nome} defaultValue={filtros[nome] ?? ''} onChange={atualizarDependentes}
              disabled={(nome === 'cidade' && !filtros.uf) || (nome === 'bairro' && !filtros.cidade)}
              aria-describedby={nome === 'uf' || nome === 'cidade' ? 'filtros-dependentes' : undefined}
              className="min-w-0 rounded border bg-[var(--background)] px-3 py-2 disabled:opacity-50">
              <option value="">Todos</option>
              {filtros[nome] && !opcoes.some(o => o.tipo === nome && o.valor === filtros[nome]) && (
                <option value={filtros[nome]}>Sem correspondência: {filtros[nome]}</option>
              )}
              {opcoes.filter(o => o.tipo === nome).map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </select>
          </div>
        ))}
      </div>
      <p id="filtros-dependentes" className="text-sm">Ao mudar estado ou cidade, a página atualiza as opções seguintes.</p>
      <div className="flex items-center gap-4">
        <button type="submit" className="rounded border px-4 py-2">Consultar</button>
        <Link href="/fila/localizar" className="text-sm underline">Limpar filtros</Link>
      </div>
    </form>
  )
}
