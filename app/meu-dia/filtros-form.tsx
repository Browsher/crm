'use client'

import Link from 'next/link'
import Form from 'next/form'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { NativeSelect } from '@/src/components/ui/native-select'
import { pedirSaidaDaEdicao } from '@/src/components/crm/descarte-edicao'
import { lerFiltrosMeuDia, urlMeuDia, type FiltrosMeuDia } from './agenda'
import styles from './meu-dia.module.css'

const RETORNOS = [{ valor: '', nome: 'Todos' }, { valor: 'atrasado', nome: 'Atrasos' }, { valor: 'hoje', nome: 'Hoje' }, { valor: 'proximos', nome: 'Próximos' }] as const

export function FiltrosForm({ filtros }: { filtros: FiltrosMeuDia }) {
  const router = useRouter()
  function submeter(form: HTMLFormElement, retorno = filtros.retorno) {
    const dados = new FormData(form)
    const leitura = lerFiltrosMeuDia({ nome: String(dados.get('nome') ?? ''), retorno, periodo: String(dados.get('periodo') ?? '') })
    if (!leitura.ok) return
    const destino = urlMeuDia(leitura.filtros)
    pedirSaidaDaEdicao(() => router.push(destino))
  }
  return <Form key={JSON.stringify(filtros)} action="/meu-dia" className={styles.filtros} onSubmit={evento => {
    evento.preventDefault()
    submeter(evento.currentTarget)
  }}>
    <input type="hidden" name="retorno" value={filtros.retorno} />
    <div className={styles.segmentos} role="group" aria-label="Filtrar retornos">
      {RETORNOS.map(item => <Button key={item.valor} variant="ghost" name="retorno" value={item.valor} type="button" aria-pressed={filtros.retorno === item.valor}
        onClick={evento => { if (evento.currentTarget.form) submeter(evento.currentTarget.form, item.valor) }}>{item.nome}</Button>)}
    </div>
    <div className={styles.pesquisa}><Label htmlFor="meu-dia-nome">Nome</Label><Input id="meu-dia-nome" name="nome" type="search"
      maxLength={120} defaultValue={filtros.nome} placeholder="Razão social ou nome fantasia" /></div>
    <Button type="submit">Filtrar</Button>
    <Button asChild variant="ghost"><Link href="/meu-dia">Limpar filtros</Link></Button>
    {filtros.retorno === 'proximos' && <div className={styles.periodo}><Label htmlFor="meu-dia-periodo">Período dos próximos retornos</Label>
      <NativeSelect id="meu-dia-periodo" name="periodo" defaultValue={filtros.periodo}>
        <option value="">Todos os próximos</option><option value="amanha">Amanhã</option>
        <option value="semana_que_vem">Semana que vem</option><option value="mes_que_vem">Mês que vem</option>
      </NativeSelect>
    </div>}
  </Form>
}
