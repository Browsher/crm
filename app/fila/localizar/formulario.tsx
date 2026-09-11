'use client'

import type { ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Filtros, OpcoesFiltro } from '@/src/features/prospeccao/tipos'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { NativeSelect } from '@/src/components/ui/native-select'
import styles from './localizar.module.css'

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
    }} className={styles.formulario}>
      <div className={styles.gradeFiltros}>
      <div className={styles.campo}>
        <Label htmlFor="filtro-nome">Nome</Label>
        <Input id="filtro-nome" name="nome" type="search" maxLength={100} defaultValue={filtros.nome}
          placeholder="Razão social ou nome fantasia" />
      </div>
        {campos.map(({ nome, label }) => (
          <div key={nome} className={styles.campo}>
            <Label htmlFor={`filtro-${nome}`}>{label}</Label>
            <NativeSelect id={`filtro-${nome}`} name={nome} defaultValue={filtros[nome] ?? ''} onChange={atualizarDependentes}
              disabled={(nome === 'cidade' && !filtros.uf) || (nome === 'bairro' && !filtros.cidade)}
              aria-describedby={nome === 'uf' || nome === 'cidade' ? 'filtros-dependentes' : undefined}>
              <option value="">Todos</option>
              {filtros[nome] && !opcoes.some(o => o.tipo === nome && o.valor === filtros[nome]) && (
                <option value={filtros[nome]}>Sem correspondência: {filtros[nome]}</option>
              )}
              {opcoes.filter(o => o.tipo === nome).map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </NativeSelect>
          </div>
        ))}
      </div>
      <p id="filtros-dependentes" className={styles.ajuda}>Ao mudar estado ou cidade, a página atualiza as opções seguintes.</p>
      <div className={styles.acoes}>
        <Button type="submit" variant="outline">Consultar</Button>
        <Button asChild variant="ghost"><Link href="/fila/localizar">Limpar filtros</Link></Button>
      </div>
    </form>
  )
}
