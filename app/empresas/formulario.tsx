'use client'

import type { ChangeEvent, FormEvent, MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ConsultaEmpresas } from '@/src/features/empresas/consulta'
import type { OpcaoFiltroEmpresa } from '@/src/features/empresas/listagem'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { NativeSelect } from '@/src/components/ui/native-select'
import styles from './empresas.module.css'

const campos = [
  { nome: 'cnae', label: 'CNAE' },
  { nome: 'uf', label: 'Estado' },
  { nome: 'cidade', label: 'Cidade' },
  { nome: 'bairro', label: 'Bairro' },
] as const

function destinoDoFormulario(formulario: HTMLFormElement): string {
  const params = new URLSearchParams()
  new FormData(formulario).forEach((valor, nome) => {
    const texto = String(valor)
    if (texto) params.set(nome, texto)
  })
  const query = params.toString()
  return query ? `/empresas?${query}` : '/empresas'
}

export function Formulario({ consulta, opcoes }: { consulta: ConsultaEmpresas; opcoes: OpcaoFiltroEmpresa[] }) {
  const router = useRouter()

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    router.push(destinoDoFormulario(evento.currentTarget))
  }

  function atualizarDependentes(evento: ChangeEvent<HTMLSelectElement>) {
    const select = evento.currentTarget
    const formulario = select.form
    if (!formulario || !['uf', 'cidade'].includes(select.name)) return
    const dependentes = select.name === 'uf' ? ['cidade', 'bairro'] : ['bairro']
    for (const nome of dependentes) {
      const campo = formulario.elements.namedItem(nome)
      if (campo instanceof HTMLSelectElement) campo.value = ''
    }
    formulario.requestSubmit()
  }

  function limparControles(evento: MouseEvent<HTMLAnchorElement>) {
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return
    evento.currentTarget.closest('form')?.reset()
  }

  const chave = JSON.stringify([
    consulta.termo,
    consulta.cnae,
    consulta.uf,
    consulta.cidade,
    consulta.bairro,
    consulta.pagina,
  ])

  return (
    <form key={chave} action="/empresas" method="get" onSubmit={enviar} className={styles.filtros}>
      <div className={styles.gradeFiltros}>
        <div className={styles.campo}>
          <Label htmlFor="empresas-busca">Buscar empresas</Label>
          <Input
            id="empresas-busca"
            type="search"
            name="q"
            maxLength={100}
            defaultValue={consulta.termo}
            placeholder="Razão social, nome fantasia ou CNPJ"
          />
        </div>
        {campos.map(({ nome, label }) => (
          <div key={nome} className={styles.campo}>
            <Label htmlFor={`empresas-${nome}`}>{label}</Label>
            <NativeSelect
              id={`empresas-${nome}`}
              name={nome}
              defaultValue={consulta[nome] ?? ''}
              onChange={atualizarDependentes}
              disabled={(nome === 'cidade' && !consulta.uf) || (nome === 'bairro' && !consulta.cidade)}
              aria-describedby={nome === 'uf' || nome === 'cidade' ? 'empresas-filtros-dependentes' : undefined}
            >
              <option value="">Todos</option>
              {consulta[nome] && !opcoes.some(opcao => opcao.tipo === nome && opcao.valor === consulta[nome]) && (
                <option value={consulta[nome]}>Sem correspondência: {consulta[nome]}</option>
              )}
              {opcoes.filter(opcao => opcao.tipo === nome).map(opcao => (
                <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
              ))}
            </NativeSelect>
          </div>
        ))}
      </div>
      <p id="empresas-filtros-dependentes" className={styles.ajuda}>
        Ao mudar estado ou cidade, a página atualiza as opções seguintes.
      </p>
      <div className={styles.acoesFiltros}>
        <Button type="submit">Buscar</Button>
        <Button asChild variant="ghost">
          <Link href="/empresas" onClick={limparControles}>Limpar filtros</Link>
        </Button>
      </div>
    </form>
  )
}
