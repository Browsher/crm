'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { normalizarCriterios, type CriteriosGoogle } from '@/src/lib/google/criterios'
import styles from './google.module.css'

export function DialogoCriterios({ dia, valor, onAplicar, leitura = false }: { dia: string; valor: CriteriosGoogle; onAplicar: (c: CriteriosGoogle) => void; leitura?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const tema = useTemaCrm()
  return <Dialog open={aberto} onOpenChange={setAberto}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm">{leitura ? 'Ver critérios' : 'Critérios de busca'}</Button></DialogTrigger>
    {aberto && <DialogContent theme={tema} className={styles.dialogoCriterios}>
      <DialogHeader><DialogTitle>Critérios de busca</DialogTitle><DialogDescription>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))}. Todos os critérios são opcionais.</DialogDescription></DialogHeader>
      <EditorCriterios valor={valor} leitura={leitura} cancelar={() => setAberto(false)} aplicar={c => { onAplicar(c); setAberto(false) }} />
    </DialogContent>}
  </Dialog>
}
function EditorCriterios({ valor, leitura, cancelar, aplicar }: { valor: CriteriosGoogle; leitura: boolean; cancelar: () => void; aplicar: (c: CriteriosGoogle) => void }) {
  const [c, setC] = useState(() => structuredClone(valor))
  const [erro, setErro] = useState<string | null>(null)
  const alterar = <K extends keyof CriteriosGoogle>(k: K, v: CriteriosGoogle[K]) => setC(anterior => ({ ...anterior, [k]: v }))
  const texto = (k: 'termos' | 'produtos' | 'excluir' | 'prioridades' | 'observacoes', rotulo: string) => <label>{rotulo}<textarea name={k} rows={2} maxLength={2000} value={c[k]} onChange={e => alterar(k, e.target.value)} className={styles.textarea} /></label>
  const caixas = (k: 'tipos' | 'site' | 'email' | 'telefone', rotulo: string, opcoes: [string, string][]) => <fieldset className={styles.caixas}><legend>{rotulo}</legend>{opcoes.map(([v, nome]) => <label key={v}><input type="checkbox" name={k} value={v} checked={(c[k] as string[]).includes(v)} onChange={e => alterar(k, (e.target.checked ? [...c[k], v] : c[k].filter(x => x !== v)) as typeof c[typeof k])} />{nome}</label>)}</fieldset>
  return <form onSubmit={e => { e.preventDefault(); const r = normalizarCriterios(c); if (!r.ok) { setErro(r.motivo); return }; aplicar(r.valor) }} className={styles.formulario}>
    <div className={styles.corpoDialogo}><fieldset disabled={leitura} className={styles.gruposCriterios}>
      <fieldset className={styles.grupoCriterios}><legend>O que procurar</legend>
        {texto('termos', 'Termos adicionais')}{texto('produtos', 'Produtos de interesse')}
        {caixas('tipos', 'Tipo de negócio', [['varejista', 'Varejista'], ['atacadista', 'Atacadista'], ['distribuidor', 'Distribuidor'], ['fabricante', 'Fabricante']])}
        <label>Forma de atendimento<NativeSelect name="atendimento" value={c.atendimento} onChange={e => alterar('atendimento', e.target.value as CriteriosGoogle['atendimento'])}><option value="">Qualquer</option><option value="priorizar_fisica">Priorizar loja física</option><option value="fisica">Somente loja física</option><option value="online">Somente online</option><option value="ambos">Loja física e online</option></NativeSelect></label>
      </fieldset>
      <fieldset className={styles.grupoCriterios}><legend>O que evitar</legend>{texto('excluir', 'Negócios e termos a evitar')}
        <label>Situação no Google<NativeSelect name="situacao" value={c.situacao} onChange={e => alterar('situacao', e.target.value as CriteriosGoogle['situacao'])}><option value="">Qualquer situação</option><option value="priorizar_funcionamento">Priorizar em funcionamento</option><option value="funcionamento">Somente em funcionamento</option><option value="excluir_encerradas">Excluir encerradas permanentemente</option><option value="excluir_fechadas">Excluir fechadas temporária ou permanentemente</option></NativeSelect></label>
      </fieldset>
      <fieldset className={styles.grupoCriterios}><legend>Contatos e presença digital</legend>
        {caixas('site', 'Site próprio', [['com', 'Com site'], ['sem', 'Sem site']])}
        {caixas('email', 'E-mail comercial publicado', [['com', 'Com e-mail'], ['sem', 'Sem e-mail']])}
        {caixas('telefone', 'Tipo de contato', [['whatsapp', 'WhatsApp'], ['fixo', 'Telefone fixo']])}
        <div className={styles.grade}><label>Nota mínima<Input name="nota" type="number" min={0} max={5} step={0.1} value={c.nota ?? ''} onChange={e => alterar('nota', e.target.value === '' ? null : Number(e.target.value))} /></label><label>Mínimo de avaliações<Input name="avaliacoes" type="number" min={0} step={1} value={c.avaliacoes ?? ''} onChange={e => alterar('avaliacoes', e.target.value === '' ? null : Number(e.target.value))} /></label></div>
      </fieldset>
      <fieldset className={styles.grupoCriterios}><legend>Orientações</legend>{texto('prioridades', 'O que priorizar')}{texto('observacoes', 'Outras orientações')}</fieldset>
    </fieldset></div>
    {erro && <p role="alert" className={styles.aviso}>{erro}</p>}
    <DialogFooter><Button type="button" variant="outline" onClick={cancelar}>{leitura ? 'Fechar' : 'Cancelar'}</Button>{!leitura && <Button type="submit">Aplicar critérios</Button>}</DialogFooter>
  </form>
}
