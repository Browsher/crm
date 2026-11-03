'use client'

import { useActionState, useCallback, useLayoutEffect, useState } from 'react'
import { Choice } from '@/src/components/ui/choice'
import { Alert } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { semanaDe } from '@/src/features/google/regras'
import type { PlanoGoogle } from '@/src/features/google/tipos'
import { copiarPlanoAcao, type EstadoPlano } from './acoes'
import type { InformarEdicao } from './guarda-edicao'
import styles from './google.module.css'

type CamposEspelho = { dias: string[]; hoje: string; historico: PlanoGoogle[]; informarEdicao: InformarEdicao; pedirFechar: () => void }

export function EspelharPlanejamento({ disabled, ...props }: CamposEspelho & { disabled: boolean }) {
  const [aberto, setAberto] = useState(false)
  const fechar = useCallback(() => setAberto(false), [])
  return <Dialog open={aberto} onOpenChange={valor => valor ? setAberto(true) : props.pedirFechar()}>
    <DialogTrigger asChild><Button type="button" variant="outline" disabled={disabled}>Espelhar um dia</Button></DialogTrigger>
    {aberto && <FormularioEspelhar {...props} fechar={fechar} />}
  </Dialog>
}

function selecionar(lista: string[], valor: string, marcado: boolean) {
  return marcado ? [...lista, valor] : lista.filter(item => item !== valor)
}

function FormularioEspelhar({ dias, hoje, historico, fechar, informarEdicao, pedirFechar }: CamposEspelho & { fechar: () => void }) {
  const tema = useTemaCrm()
  const semanas = [...new Set(historico.map(p => semanaDe(p.dia)?.[0]).filter((d): d is string => Boolean(d)))].sort().reverse()
  const [semana, setSemana] = useState(semanas[0] ?? '')
  const origens = historico.filter(p => semanaDe(p.dia)?.[0] === semana)
  const [origem, setOrigem] = useState(origens[0]?.id ?? '')
  const [semanaDestino, setSemanaDestino] = useState(dias[0])
  const [campos, setCampos] = useState(['nicho'])
  const [destinos, setDestinos] = useState<string[]>([])
  const [baseline] = useState(() => ({ semana, origem, semanaDestino }))
  const [incerto, setIncerto] = useState(false)
  const alvo = new Date(dias[0] + 'T12:00:00Z'); alvo.setUTCDate(alvo.getUTCDate() + 7)
  const proxima = alvo.toISOString().slice(0, 10)
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoPlano, form: FormData) => {
    try {
      return await copiarPlanoAcao(anterior, form)
    } catch {
      setIncerto(true)
      return { erro: 'Não foi possível confirmar o espelhamento. Confira os dias de destino antes de tentar novamente.', salvo: false }
    }
  }, { erro: null, salvo: false })
  const alterado = !estado.salvo && (incerto || semana !== baseline.semana || origem !== baseline.origem
    || semanaDestino !== baseline.semanaDestino || campos.length !== 1 || campos[0] !== 'nicho' || destinos.length > 0)
  useLayoutEffect(() => {
    informarEdicao({ alterado, pendente, fechar })
    return () => informarEdicao(null)
  }, [alterado, pendente, fechar, informarEdicao])
  const selecionado = historico.find(p => p.id === origem)
  const data = (d: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'))
  return <DialogContent theme={tema} className={styles.dialogoCriterios} showCloseButton={!pendente}>
    <DialogHeader><DialogTitle>Espelhar planejamento</DialogTitle><DialogDescription>Escolha um dia salvo, os campos que quer copiar e os dias de destino.</DialogDescription></DialogHeader>
    <form action={acao} className={styles.formulario}>
    <input type="hidden" name="origem" value={origem} /><input type="hidden" name="revisao" value={selecionado?.revisao ?? 1} />
    <fieldset disabled={pendente || estado.salvo || incerto} className={styles.corpoDialogo}>
      <div className={styles.grade}><label>Semana de origem<NativeSelect value={semana} onChange={e => { setSemana(e.target.value); setOrigem(historico.find(p => semanaDe(p.dia)?.[0] === e.target.value)?.id ?? '') }}>{semanas.map(d => <option key={d} value={d}>Semana de {data(d)}</option>)}</NativeSelect></label>
        <label>Dia de origem<NativeSelect value={origem} onChange={e => setOrigem(e.target.value)}>{origens.map(p => <option key={p.id} value={p.id}>{data(p.dia)} · {p.nicho || 'Não definido'} · {p.bairro || p.cidade || 'Sem região'}</option>)}</NativeSelect></label></div>
      <fieldset className={styles.caixas}><legend>O que copiar</legend>{[['nicho', 'Nicho'], ['criterios', 'Critérios de busca'], ['regiao', 'Região: bairro, cidade e UF']].map(([v, r]) => <label key={v}><Choice type="checkbox" name="campos" value={v} checked={campos.includes(v)} onChange={e => setCampos(selecionar(campos, v, e.target.checked))} />{r}</label>)}</fieldset>
      <label>Semana de destino<NativeSelect value={semanaDestino} onChange={e => { setSemanaDestino(e.target.value); setDestinos([]) }}><option value={dias[0]}>Semana exibida</option><option value={proxima}>Próxima semana</option></NativeSelect></label>
      <fieldset className={styles.caixas}><legend>Dias de destino</legend>{(semanaDe(semanaDestino) ?? []).map(d => <label key={d}><Choice type="checkbox" name="destinos" value={d} disabled={d <= hoje || d === selecionado?.dia} checked={destinos.includes(d)} onChange={e => setDestinos(selecionar(destinos, d, e.target.checked))} />{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'))}, {data(d)}</label>)}</fieldset>
    </fieldset>
    {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}{estado.salvo && <Alert role="status" variant="success">{estado.aviso ?? 'Planejamento espelhado.'}</Alert>}
    <DialogFooter>
      <Button type="button" variant="outline" disabled={pendente} onClick={pedirFechar}>{estado.salvo ? 'Concluir' : estado.erro ? 'Fechar' : 'Cancelar'}</Button>
      {!estado.salvo && <Button type="submit" disabled={pendente || incerto}>{pendente ? 'Espelhando…' : 'Espelhar nos dias escolhidos'}</Button>}
    </DialogFooter>
    </form>
  </DialogContent>
}
