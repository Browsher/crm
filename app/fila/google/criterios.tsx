'use client'

import { useCallback, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/src/components/ui/button'
import { Textarea } from '@/src/components/ui/textarea'
import { Choice } from '@/src/components/ui/choice'
import { Alert } from '@/src/components/ui/alert'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Dialog, DialogTrigger } from '@/src/components/ui/dialog'
import { MenuPainelCrm } from '@/src/components/crm/menu-painel'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { normalizarCriterios, type CriteriosGoogle } from '@/src/lib/google/criterios'
import type { InformarEdicao } from './guarda-edicao'
import styles from './google.module.css'

type CampoTexto = 'termos' | 'produtos' | 'excluir' | 'prioridades' | 'observacoes'

const GRUPOS = {
  empresas: 'Empresas e produtos',
  contatos: 'Contatos e presença digital',
  preferencias: 'Preferências e restrições',
}
type Grupo = keyof typeof GRUPOS

const EXEMPLOS: Record<CampoTexto, string> = {
  termos: 'Ex.: segurança eletrônica, instalação de câmeras.',
  produtos: 'Ex.: câmeras de segurança, alarmes e interfones.',
  excluir: 'Ex.: lojas de usados.',
  prioridades: 'Ex.: lojas que atendem instaladores de câmeras.',
  observacoes: 'Ex.: verificar se a loja oferece orçamento para condomínios.',
}

function compararCampos(c: CriteriosGoogle) {
  return JSON.stringify(c, (_chave, valor: unknown) => Array.isArray(valor) ? [...valor].sort() : valor)
}

export function DialogoCriterios({ dia, valor, onAplicar, leitura = false, informarEdicao, pedirFechar }: {
  dia: string; valor: CriteriosGoogle; onAplicar: (c: CriteriosGoogle) => void; leitura?: boolean
  informarEdicao: InformarEdicao; pedirFechar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const fechar = useCallback(() => setAberto(false), [])
  return <Dialog open={aberto} onOpenChange={valor => valor ? setAberto(true) : pedirFechar()}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm">{leitura ? 'Ver critérios' : 'Critérios de busca'}</Button></DialogTrigger>
    {aberto && <EditorCriterios dia={dia} valor={valor} leitura={leitura} fechar={fechar} informarEdicao={informarEdicao} cancelar={pedirFechar} aplicar={c => { onAplicar(c); fechar() }} />}
  </Dialog>
}
function EditorCriterios({ dia, valor, leitura, fechar, informarEdicao, cancelar, aplicar }: {
  dia: string; valor: CriteriosGoogle; leitura: boolean; fechar: () => void; informarEdicao: InformarEdicao
  cancelar: () => void; aplicar: (c: CriteriosGoogle) => void
}) {
  const formId = useId()
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const ultimoGrupo = useRef<Grupo | null>(null)
  const tituloGrupo = useRef<HTMLHeadingElement>(null)
  const formulario = useRef<HTMLFormElement>(null)
  const [baseline] = useState(() => compararCampos(valor))
  const [c, setC] = useState(() => structuredClone(valor))
  const [erro, setErro] = useState<string | null>(null)
  const alterado = !leitura && compararCampos(c) !== baseline
  useLayoutEffect(() => {
    informarEdicao({ alterado, pendente: false, fechar })
    return () => informarEdicao(null)
  }, [alterado, fechar, informarEdicao])
  useLayoutEffect(() => {
    if (grupo) {
      ultimoGrupo.current = grupo
      tituloGrupo.current?.focus()
    } else if (ultimoGrupo.current) {
      document.getElementById(`${formId}-${ultimoGrupo.current}`)?.focus()
    }
  }, [grupo, formId])

  function voltarAoMenu() {
    // Uma entrada como "-" tem value vazio, mas ainda não é um campo limpo.
    const incompleto = Array.from(formulario.current?.querySelectorAll<HTMLInputElement>('input[type="number"]') ?? [])
      .find(campo => campo.validity.badInput)
    if (incompleto) {
      incompleto.reportValidity()
      return
    }
    setGrupo(null)
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    // O portal separa os formulários no DOM, mas o evento React sobe até o planejamento.
    evento.stopPropagation()
    if (leitura) return
    if (grupo !== 'contatos' && c.nota !== null && !Number.isInteger(c.nota * 10)) {
      setErro('Informe a nota mínima com até uma casa decimal.')
      setGrupo('contatos')
      return
    }
    const resultado = normalizarCriterios(c)
    if (!resultado.ok) {
      setErro(resultado.motivo)
      return
    }
    aplicar(resultado.valor)
  }

  const alterar = <K extends keyof CriteriosGoogle>(k: K, v: CriteriosGoogle[K]) => setC(anterior => ({ ...anterior, [k]: v }))
  const texto = (k: CampoTexto, rotulo: string) => <label>{rotulo}<Textarea name={k} placeholder={EXEMPLOS[k]} rows={2} maxLength={2000} value={c[k]} onChange={e => alterar(k, e.target.value)} /></label>
  const caixas = (k: 'tipos' | 'site' | 'email' | 'telefone', rotulo: string, opcoes: [string, string][]) => <fieldset className={styles.caixas}><legend>{rotulo}</legend>{opcoes.map(([v, nome]) => <label key={v}><Choice type="checkbox" name={k} value={v} checked={(c[k] as string[]).includes(v)} onChange={e => alterar(k, (e.target.checked ? [...c[k], v] : c[k].filter(x => x !== v)) as typeof c[typeof k])} />{nome}</label>)}</fieldset>
  const descricao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))
  return <PainelSobrepostoCrm titulo="Critérios de busca" descricao={`${descricao}. Todos os critérios são opcionais.`}
    rotuloFechar={grupo ? 'Voltar' : 'Fechar'} aoFechar={grupo ? voltarAoMenu : cancelar} aoSair={cancelar}
    rodape={leitura ? undefined : <>
      <Button type="button" variant="outline" onClick={cancelar}>Cancelar</Button>
      <Button type="submit" form={formId}>Aplicar critérios</Button>
    </>}>
    {!grupo && <MenuPainelCrm rotulo="Grupos de critérios" itens={(Object.keys(GRUPOS) as Grupo[]).map(chave => ({
      id: `${formId}-${chave}`, titulo: GRUPOS[chave], aoAbrir: () => setGrupo(chave),
    }))} />}
    <form id={formId} ref={formulario} onSubmit={enviar} className={`${styles.formulario} ${styles.editorCriterios}`}>
      {grupo && <h3 ref={tituloGrupo} tabIndex={-1} className={styles.tituloGrupo}>{GRUPOS[grupo]}</h3>}
      {grupo && <fieldset disabled={leitura} aria-label={GRUPOS[grupo]}>
      {grupo === 'empresas' && <>
        {texto('termos', 'Termos adicionais')}{texto('produtos', 'Produtos de interesse')}
        {caixas('tipos', 'Tipo de negócio', [['varejista', 'Varejista'], ['atacadista', 'Atacadista'], ['distribuidor', 'Distribuidor'], ['fabricante', 'Fabricante']])}
        <label>Forma de atendimento<NativeSelect name="atendimento" value={c.atendimento} onChange={e => alterar('atendimento', e.target.value as CriteriosGoogle['atendimento'])}><option value="">Qualquer</option><option value="priorizar_fisica">Priorizar loja física</option><option value="fisica">Somente loja física</option><option value="online">Somente online</option><option value="ambos">Loja física e online</option></NativeSelect></label>
      </>}
      {grupo === 'contatos' && <>
        {caixas('site', 'Site próprio', [['com', 'Com site'], ['sem', 'Sem site']])}
        {caixas('email', 'E-mail comercial publicado', [['com', 'Com e-mail'], ['sem', 'Sem e-mail']])}
        {caixas('telefone', 'Tipo de contato', [['whatsapp', 'WhatsApp'], ['fixo', 'Telefone fixo']])}
        <div className={styles.gradeNumeros}>
          <label>Nota mínima<Input name="nota" type="number" min={0} max={5} step={0.1} value={c.nota ?? ''} onChange={e => alterar('nota', e.target.value === '' ? null : Number(e.target.value))} /></label>
          <label>Mínimo de avaliações<Input name="avaliacoes" type="number" min={0} step={1} value={c.avaliacoes ?? ''} onChange={e => alterar('avaliacoes', e.target.value === '' ? null : Number(e.target.value))} /></label>
        </div>
      </>}
      {grupo === 'preferencias' && <>
        {texto('excluir', 'Negócios e termos a evitar')}
        <label>Situação no Google<NativeSelect name="situacao" value={c.situacao} onChange={e => alterar('situacao', e.target.value as CriteriosGoogle['situacao'])}><option value="">Qualquer situação</option><option value="priorizar_funcionamento">Priorizar em funcionamento</option><option value="funcionamento">Somente em funcionamento</option><option value="excluir_encerradas">Excluir encerradas permanentemente</option><option value="excluir_fechadas">Excluir fechadas temporária ou permanentemente</option></NativeSelect></label>
        {texto('prioridades', 'O que priorizar')}{texto('observacoes', 'Outras orientações')}
      </>}
      </fieldset>}
      {erro && <Alert variant="danger">{erro}</Alert>}
    </form>
  </PainelSobrepostoCrm>
}
