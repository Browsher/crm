'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { semanaDe } from '@/src/features/google/regras'
import type { PlanoGoogle } from '@/src/features/google/tipos'
import { copiarPlanoAcao } from './acoes'
import styles from './google.module.css'

export function EspelharPlanejamento({ dias, hoje, historico, disabled }: { dias: string[]; hoje: string; historico: PlanoGoogle[]; disabled: boolean }) {
  const [aberto, setAberto] = useState(false)
  const tema = useTemaCrm()
  return <Dialog open={aberto} onOpenChange={setAberto}><DialogTrigger asChild><Button type="button" variant="outline" disabled={disabled}>Espelhar um dia</Button></DialogTrigger>
    {aberto && <DialogContent theme={tema} className={styles.dialogoCriterios}><DialogHeader><DialogTitle>Espelhar planejamento</DialogTitle><DialogDescription>Escolha um dia salvo, os campos que quer copiar e os dias de destino.</DialogDescription></DialogHeader>
      <FormularioEspelhar dias={dias} hoje={hoje} historico={historico} fechar={() => setAberto(false)} />
    </DialogContent>}
  </Dialog>
}
function FormularioEspelhar({ dias, hoje, historico, fechar }: { dias: string[]; hoje: string; historico: PlanoGoogle[]; fechar: () => void }) {
  const semanas = [...new Set(historico.map(p => semanaDe(p.dia)?.[0]).filter((d): d is string => Boolean(d)))].sort().reverse()
  const [semana, setSemana] = useState(semanas[0] ?? '')
  const origens = historico.filter(p => semanaDe(p.dia)?.[0] === semana)
  const [origem, setOrigem] = useState(origens[0]?.id ?? '')
  const [semanaDestino, setSemanaDestino] = useState(dias[0])
  const alvo = new Date(dias[0] + 'T12:00:00Z'); alvo.setUTCDate(alvo.getUTCDate() + 7)
  const proxima = alvo.toISOString().slice(0, 10)
  const [estado, acao, pendente] = useActionState(copiarPlanoAcao, { erro: null, salvo: false })
  const selecionado = historico.find(p => p.id === origem)
  const data = (d: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'))
  return <form action={acao} className={styles.formulario}>
    <input type="hidden" name="origem" value={origem} /><input type="hidden" name="revisao" value={selecionado?.revisao ?? 1} />
    <fieldset disabled={pendente} className={styles.corpoDialogo}>
      <div className={styles.grade}><label>Semana de origem<NativeSelect value={semana} onChange={e => { setSemana(e.target.value); setOrigem(historico.find(p => semanaDe(p.dia)?.[0] === e.target.value)?.id ?? '') }}>{semanas.map(d => <option key={d} value={d}>Semana de {data(d)}</option>)}</NativeSelect></label>
        <label>Dia de origem<NativeSelect value={origem} onChange={e => setOrigem(e.target.value)}>{origens.map(p => <option key={p.id} value={p.id}>{data(p.dia)} · {p.nicho || 'Não definido'} · {p.bairro || p.cidade || 'Sem região'}</option>)}</NativeSelect></label></div>
      <fieldset className={styles.caixas}><legend>O que copiar</legend>{[['nicho', 'Nicho'], ['criterios', 'Critérios de busca'], ['regiao', 'Região: bairro, cidade e UF']].map(([v, r]) => <label key={v}><input type="checkbox" name="campos" value={v} defaultChecked={v === 'nicho'} />{r}</label>)}</fieldset>
      <label>Semana de destino<NativeSelect value={semanaDestino} onChange={e => setSemanaDestino(e.target.value)}><option value={dias[0]}>Semana exibida</option><option value={proxima}>Próxima semana</option></NativeSelect></label>
      <fieldset className={styles.caixas} key={semanaDestino}><legend>Dias de destino</legend>{(semanaDe(semanaDestino) ?? []).map(d => <label key={d}><input type="checkbox" name="destinos" value={d} disabled={d <= hoje || d === selecionado?.dia} />{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'))}, {data(d)}</label>)}</fieldset>
    </fieldset>
    {estado.erro && <p role="alert" className={styles.aviso}>{estado.erro}</p>}{estado.salvo && <p role="status" className={styles.sucesso}>{estado.aviso ?? 'Planejamento espelhado.'}</p>}
    <DialogFooter><Button type="button" variant="outline" disabled={pendente} onClick={fechar}>{estado.salvo ? 'Concluir' : 'Cancelar'}</Button><Button type="submit" disabled={pendente}>{pendente ? 'Espelhando…' : 'Espelhar nos dias escolhidos'}</Button></DialogFooter>
  </form>
}
