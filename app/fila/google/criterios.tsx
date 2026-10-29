'use client'

import { useId, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Textarea } from '@/src/components/ui/textarea'
import { Choice } from '@/src/components/ui/choice'
import { Alert } from '@/src/components/ui/alert'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { normalizarCriterios, type CriteriosGoogle } from '@/src/lib/google/criterios'
import styles from './google.module.css'

const AJUDAS: Record<keyof CriteriosGoogle, string> = {
  termos: 'Acrescente palavras para detalhar a busca. Ex.: segurança eletrônica, instalação de câmeras.',
  produtos: 'Descreva os produtos de interesse. Ex.: câmeras de segurança, alarmes e interfones.',
  tipos: 'Escolha o perfil de empresa desejado. Ex.: Varejista é a loja que vende para o consumidor final.',
  atendimento: 'Defina o atendimento desejado. Ex.: Somente loja física pede atendimento presencial. Priorizar indica preferência.',
  excluir: 'Escreva o que deve ficar fora da busca. Ex.: lojas de usados.',
  situacao: 'Defina a situação desejada no Google. Ex.: Somente em funcionamento pede negócios em atividade. Priorizar indica preferência.',
  site: 'Ex.: Com site exige um site próprio. Sem site indica negócios sem site. Marcar as duas opções deixa esse critério livre.',
  email: 'Ex.: Com e-mail exige um e-mail comercial publicado. Sem e-mail indica negócios sem esse contato. Marcar as duas opções deixa esse critério livre.',
  telefone: 'Escolha WhatsApp, Telefone fixo ou ambos. Ex.: com os dois marcados, qualquer um desses contatos serve.',
  nota: 'Informe uma nota entre 0 e 5. Ex.: 4,5 como nota mínima no Google.',
  avaliacoes: 'Informe o mínimo de avaliações no Google. Ex.: 20 para buscar negócios com pelo menos 20 avaliações.',
  prioridades: 'Descreva o que deve ter preferência. Ex.: dar preferência a lojas que atendem instaladores de câmeras.',
  observacoes: 'Registre orientações comerciais específicas. Ex.: verificar se a loja oferece orçamento para condomínios.',
}

export function DialogoCriterios({ dia, valor, onAplicar, leitura = false }: { dia: string; valor: CriteriosGoogle; onAplicar: (c: CriteriosGoogle) => void; leitura?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const tema = useTemaCrm()
  return <Dialog open={aberto} onOpenChange={setAberto}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm">{leitura ? 'Ver critérios' : 'Critérios de busca'}</Button></DialogTrigger>
    {aberto && <DialogContent theme={tema} className={`${styles.dialogoCriterios} ${styles.editorCriterios}`}>
      <DialogHeader><DialogTitle>Critérios de busca</DialogTitle><DialogDescription>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))}. Todos os critérios são opcionais.</DialogDescription></DialogHeader>
      <EditorCriterios valor={valor} leitura={leitura} cancelar={() => setAberto(false)} aplicar={c => { onAplicar(c); setAberto(false) }} />
    </DialogContent>}
  </Dialog>
}
function EditorCriterios({ valor, leitura, cancelar, aplicar }: { valor: CriteriosGoogle; leitura: boolean; cancelar: () => void; aplicar: (c: CriteriosGoogle) => void }) {
  const [c, setC] = useState(() => structuredClone(valor))
  const [erro, setErro] = useState<string | null>(null)
  const idBase = useId()
  const idAjuda = (k: keyof CriteriosGoogle) => `${idBase}-${k}-ajuda`
  const ajuda = (k: keyof CriteriosGoogle) => <small id={idAjuda(k)} className={styles.ajuda}>{AJUDAS[k]}</small>
  const alterar = <K extends keyof CriteriosGoogle>(k: K, v: CriteriosGoogle[K]) => setC(anterior => ({ ...anterior, [k]: v }))
  const texto = (k: 'termos' | 'produtos' | 'excluir' | 'prioridades' | 'observacoes', rotulo: string) => <div className={styles.campoCriterio}><label>{rotulo}<Textarea name={k} aria-describedby={idAjuda(k)} rows={2} maxLength={2000} value={c[k]} onChange={e => alterar(k, e.target.value)} /></label>{ajuda(k)}</div>
  const caixas = (k: 'tipos' | 'site' | 'email' | 'telefone', rotulo: string, opcoes: [string, string][]) => <div className={styles.campoCriterio}><fieldset className={styles.caixas} aria-describedby={idAjuda(k)}><legend>{rotulo}</legend>{opcoes.map(([v, nome]) => <label key={v}><Choice type="checkbox" name={k} value={v} checked={(c[k] as string[]).includes(v)} onChange={e => alterar(k, (e.target.checked ? [...c[k], v] : c[k].filter(x => x !== v)) as typeof c[typeof k])} />{nome}</label>)}</fieldset>{ajuda(k)}</div>
  return <form onSubmit={e => { e.preventDefault(); const r = normalizarCriterios(c); if (!r.ok) { setErro(r.motivo); return }; aplicar(r.valor) }} className={styles.formulario}>
    <div className={styles.corpoDialogo}><fieldset disabled={leitura} className={styles.gruposCriterios}>
      <fieldset className={styles.grupoCriterios}><legend>O que procurar</legend>
        {texto('termos', 'Termos adicionais')}{texto('produtos', 'Produtos de interesse')}
        {caixas('tipos', 'Tipo de negócio', [['varejista', 'Varejista'], ['atacadista', 'Atacadista'], ['distribuidor', 'Distribuidor'], ['fabricante', 'Fabricante']])}
        <div className={styles.campoCriterio}><label>Forma de atendimento<NativeSelect name="atendimento" aria-describedby={idAjuda('atendimento')} value={c.atendimento} onChange={e => alterar('atendimento', e.target.value as CriteriosGoogle['atendimento'])}><option value="">Qualquer</option><option value="priorizar_fisica">Priorizar loja física</option><option value="fisica">Somente loja física</option><option value="online">Somente online</option><option value="ambos">Loja física e online</option></NativeSelect></label>{ajuda('atendimento')}</div>
      </fieldset>
      <fieldset className={styles.grupoCriterios}><legend>O que evitar</legend>{texto('excluir', 'Negócios e termos a evitar')}
        <div className={styles.campoCriterio}><label>Situação no Google<NativeSelect name="situacao" aria-describedby={idAjuda('situacao')} value={c.situacao} onChange={e => alterar('situacao', e.target.value as CriteriosGoogle['situacao'])}><option value="">Qualquer situação</option><option value="priorizar_funcionamento">Priorizar em funcionamento</option><option value="funcionamento">Somente em funcionamento</option><option value="excluir_encerradas">Excluir encerradas permanentemente</option><option value="excluir_fechadas">Excluir fechadas temporária ou permanentemente</option></NativeSelect></label>{ajuda('situacao')}</div>
      </fieldset>
      <fieldset className={styles.grupoCriterios}><legend>Contatos e presença digital</legend>
        {caixas('site', 'Site próprio', [['com', 'Com site'], ['sem', 'Sem site']])}
        {caixas('email', 'E-mail comercial publicado', [['com', 'Com e-mail'], ['sem', 'Sem e-mail']])}
        {caixas('telefone', 'Tipo de contato', [['whatsapp', 'WhatsApp'], ['fixo', 'Telefone fixo']])}
        <div className={styles.grade}>
          <div className={styles.campoCriterio}><label>Nota mínima<Input name="nota" aria-describedby={idAjuda('nota')} type="number" min={0} max={5} step={0.1} value={c.nota ?? ''} onChange={e => alterar('nota', e.target.value === '' ? null : Number(e.target.value))} /></label>{ajuda('nota')}</div>
          <div className={styles.campoCriterio}><label>Mínimo de avaliações<Input name="avaliacoes" aria-describedby={idAjuda('avaliacoes')} type="number" min={0} step={1} value={c.avaliacoes ?? ''} onChange={e => alterar('avaliacoes', e.target.value === '' ? null : Number(e.target.value))} /></label>{ajuda('avaliacoes')}</div>
        </div>
      </fieldset>
      <fieldset className={styles.grupoCriterios}><legend>Orientações</legend>{texto('prioridades', 'O que priorizar')}{texto('observacoes', 'Outras orientações')}</fieldset>
    </fieldset></div>
    {erro && <Alert variant="danger">{erro}</Alert>}
    <DialogFooter><Button type="button" variant="outline" onClick={cancelar}>{leitura ? 'Fechar' : 'Cancelar'}</Button>{!leitura && <Button type="submit">Aplicar critérios</Button>}</DialogFooter>
  </form>
}
