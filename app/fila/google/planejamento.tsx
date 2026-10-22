'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Alert } from '@/src/components/ui/alert'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { ESTADOS_GOOGLE, type PlanoGoogle } from '@/src/features/google/tipos'
import { salvarPlanoAcao, type EstadoPlano } from './acoes'
import styles from './google.module.css'
import { SincronizarPlanejamento } from './sincronizar'

const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const diaDaSemana = (dia: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))
const dataCurta = (dia: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))

export function PlanejamentoSemanal({ dias, planos, hoje, rotinaIniciada }: { dias: string[]; planos: PlanoGoogle[]; hoje: string; rotinaIniciada: boolean }) {
  return <div className={styles.semana}>{dias.map(dia => {
    const plano = planos.find(p => p.dia === dia)
    const bloqueado = dia < hoje || (dia === hoje && rotinaIniciada) || Boolean(plano && plano.estado !== 'planejado')
    const situacao = !plano ? 'Sem pedido' : plano.estado === 'planejado' && dia < hoje ? 'Não executado' : ESTADOS_GOOGLE[plano.estado]
    return <article key={dia} className={styles.dia} aria-label={diaDaSemana(dia)}>
      <div className={styles.data}><strong>{diaDaSemana(dia)}</strong><time dateTime={dia}>{dataCurta(dia)}</time></div>
      <div className={styles.criterios}><strong>{plano?.nicho ?? 'Defina o nicho deste dia'}</strong>
        <p>{plano ? [plano.bairro || 'Cidade inteira', plano.cidade, plano.uf].join(', ') : 'O agente só busca quando você salva um pedido.'}</p>
        {plano && <><small>{plano.sincronizado?'Sincronizado com a planilha':'Salvo no CRM. Sincronização pendente.'}</small>
          {!plano.sincronizado && <SincronizarPlanejamento pedido={plano.id} />}</>}
      </div>
      <span className={styles.situacao} data-estado={plano?.estado ?? 'vazio'}>{situacao}</span>
      <EditarDia dia={dia} plano={plano} bloqueado={bloqueado} />
    </article>
  })}</div>
}
function EditarDia({ dia, plano, bloqueado }: { dia: string; plano?: PlanoGoogle; bloqueado: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [pendente, setPendente] = useState(false)
  const tema = useTemaCrm()
  return <Dialog open={aberto} onOpenChange={v => { if (!pendente) setAberto(v) }}>
    <DialogTrigger asChild><Button variant="outline" disabled={bloqueado} aria-label={`${plano ? 'Editar' : 'Planejar'} ${diaDaSemana(dia)}, ${dataCurta(dia)}`}>{plano ? 'Editar dia' : 'Planejar dia'}</Button></DialogTrigger>
    {aberto && <DialogContent theme={tema} showCloseButton={!pendente} onEscapeKeyDown={e => { if (pendente) e.preventDefault() }} onPointerDownOutside={e => { if (pendente) e.preventDefault() }}>
      <DialogHeader><DialogTitle>Planejar {diaDaSemana(dia)}</DialogTitle><DialogDescription>{dataCurta(dia)}. O agente fará a busca diária com estes critérios.</DialogDescription></DialogHeader>
      <FormularioDia dia={dia} plano={plano} informarPendencia={setPendente} fechar={() => setAberto(false)} />
    </DialogContent>}
  </Dialog>
}
function FormularioDia({ dia, plano, informarPendencia, fechar }: { dia: string; plano?: PlanoGoogle; informarPendencia: (v: boolean) => void; fechar: () => void }) {
  const inicial: EstadoPlano = { erro: null, salvo: false }
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoPlano, form: FormData) => {
    informarPendencia(true)
    try { return await salvarPlanoAcao(anterior, form) } finally { informarPendencia(false) }
  }, inicial)
  return <form action={acao} className={styles.formulario}>
    <input name="dia" type="hidden" value={dia} />
    <fieldset disabled={pendente}>
      <label>Nicho<Input name="nicho" required maxLength={100} defaultValue={plano?.nicho ?? ''} placeholder="Ex.: loja de brinquedos" /></label>
      <div className={styles.grade}><label>Cidade<Input name="cidade" required maxLength={100} defaultValue={plano?.cidade ?? ''} autoComplete="address-level2" /></label>
        <label>UF<NativeSelect name="uf" aria-label="UF" required defaultValue={plano?.uf ?? ''} autoComplete="address-level1"><option value="">Selecione</option>{ufs.map(uf => <option key={uf}>{uf}</option>)}</NativeSelect></label></div>
      <label>Bairro<Input name="bairro" aria-label="Bairro" maxLength={100} defaultValue={plano?.bairro ?? ''} /><small>Opcional. Deixe vazio para buscar na cidade inteira.</small></label>
    </fieldset>
    <p className={styles.ajuda}>Até 50 leads por pedido. Os critérios ficam fechados quando o agente inicia a rotina do dia.</p>
    {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
    {estado.salvo && <p role="status" className={styles.sucesso}>Dia salvo no planejamento.</p>}
    {estado.salvo && estado.sincronizacao==='sincronizado' && <p className={styles.sucesso}>Sincronizado com a planilha.</p>}
    {estado.salvo && estado.sincronizacao==='pendente' && <p role="alert" className={styles.aviso}>{estado.aviso ?? 'Salvo no CRM. Sincronização pendente.'}</p>}
    <DialogFooter><Button variant="outline" type="button" onClick={fechar} disabled={pendente}>{estado.salvo ? 'Concluir' : 'Cancelar'}</Button>
      <Button type="submit" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar dia'}</Button></DialogFooter>
  </form>
}
