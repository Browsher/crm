'use client'

import { useCallback, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { MapPin, Sparkles } from 'lucide-react'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { Alert } from '@/src/components/ui/alert'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Choice } from '@/src/components/ui/choice'
import { Dialog, DialogTrigger } from '@/src/components/ui/dialog'
import { Textarea } from '@/src/components/ui/textarea'
import { LIMITE_DESCRICAO_IA, type SugestaoGoogle, type SugestoesGoogle } from '@/src/lib/google/assistente-ia'
import type { InformarEdicao } from './guarda-edicao'
import { sugerirFiltrosGoogleAcao } from './sugestoes-ia'
import styles from './google.module.css'

type Props = {
  disponivel: boolean
  bloqueado: boolean
  dia: string
  informarEdicao: InformarEdicao
  pedirFechar: () => void
  aoAplicar: (sugestao: SugestaoGoogle, regiao: SugestoesGoogle['regiao']) => void
}

export function AssistenteIaGoogle({ disponivel, bloqueado, dia, informarEdicao, pedirFechar, aoAplicar }: Props) {
  const [aberto, setAberto] = useState(false)
  const fechar = useCallback(() => setAberto(false), [])

  const gatilho = <Button type="button" variant="outline" size="sm" disabled={!disponivel || bloqueado}>
    <Sparkles aria-hidden="true" /><span>Sugerir filtros com IA</span>
  </Button>

  if (!disponivel) return <div className={styles.iaEmBreve}>
    {gatilho}<Badge variant="outline">Em breve</Badge>
  </div>

  return <Dialog open={aberto} onOpenChange={valor => valor ? setAberto(true) : pedirFechar()}>
    <DialogTrigger asChild>{gatilho}</DialogTrigger>
    {aberto && <EditorAssistente dia={dia} fechar={fechar} informarEdicao={informarEdicao} pedirFechar={pedirFechar}
      aoAplicar={(sugestao, regiao) => { aoAplicar(sugestao, regiao); fechar() }} />}
  </Dialog>
}

const ROTULOS = [['nicho', 'Nicho'], ['termos', 'Termos adicionais'], ['produtos', 'Produtos de interesse'], ['excluir', 'Termos a evitar']] as const

function EditorAssistente({ dia, fechar, informarEdicao, pedirFechar, aoAplicar }: Pick<Props, 'dia' | 'informarEdicao' | 'pedirFechar' | 'aoAplicar'> & { fechar: () => void }) {
  const [descricao, setDescricao] = useState('')
  const [dados, setDados] = useState<SugestoesGoogle | null>(null)
  const [escolhida, setEscolhida] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)
  const enviando = useRef(false)
  const alterado = Boolean(descricao.trim())

  useLayoutEffect(() => {
    informarEdicao({ alterado, pendente, fechar })
    return () => informarEdicao(null)
  }, [alterado, pendente, fechar, informarEdicao])

  async function gerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    // O portal separa os formulários no DOM, mas o evento React sobe até a semana.
    evento.stopPropagation()
    if (enviando.current || !descricao.trim()) return
    enviando.current = true
    setPendente(true)
    setDados(null)
    setErro(null)
    try {
      const resultado = await sugerirFiltrosGoogleAcao(descricao)
      if (resultado.ok) {
        setDados(resultado.valor)
        setEscolhida(0)
      } else {
        setErro(resultado.motivo)
      }
    } catch {
      setErro('Não foi possível gerar sugestões. Tente novamente ou preencha os critérios manualmente.')
    } finally {
      enviando.current = false
      setPendente(false)
    }
  }

  const atual = dados?.sugestoes[escolhida]
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))
  return <PainelSobrepostoCrm titulo="Sugerir filtros com IA"
    descricao={<><span>Descreva seu produto e escolha um público para prospectar.</span><br /><span>{data}</span></>}
    aoFechar={pedirFechar} fecharBloqueado={pendente} ocupado={pendente} rodape={<div className={styles.iaRodape}>
      <span className="sr-only" role="status">{pendente ? 'Gerando sugestões.' : ''}</span>
      <span className={styles.ajuda}>Preenche o rascunho para você revisar antes de salvar.</span>
      <Button type="button" disabled={pendente || !atual} onClick={() => { if (atual) aoAplicar(atual, dados?.regiao) }}>Aplicar filtros</Button>
    </div>}>
    <form className={styles.formulario} onSubmit={gerar}>
      <label>O que você quer vender?
        <Textarea name="descricao" rows={2} maxLength={LIMITE_DESCRICAO_IA} value={descricao} required disabled={pendente}
          placeholder="Ex.: Quero vender câmeras Wi-Fi no Brás, em São Paulo."
          onChange={evento => { setDescricao(evento.target.value); setDados(null); setErro(null) }} />
      </label>
      <div className={styles.iaGerar}><Button type="submit" variant="outline" disabled={pendente || !descricao.trim()}>
        <Sparkles aria-hidden="true" /><span>{pendente ? 'Gerando sugestões…' : 'Gerar sugestões'}</span>
      </Button></div>
    </form>
    {erro && <Alert role="alert" variant="danger">{erro}</Alert>}
    {dados && <fieldset className={styles.iaSugestoes}>
      <legend>Sugestões de público</legend>
      <p className={styles.ajuda} role="status">{dados.sugestoes.length} {dados.sugestoes.length === 1 ? 'opção disponível' : 'opções disponíveis'}. Escolha uma para preencher o formulário.</p>
      {dados.regiao && <div className={styles.iaRegiao}>
        <MapPin aria-hidden="true" size={16} />
        <span>Região</span>
        <strong>{dados.regiao.bairro || 'Cidade inteira'}, {dados.regiao.cidade}/{dados.regiao.uf}</strong>
      </div>}
      {dados.sugestoes.map((sugestao, indice) => <label key={sugestao.nicho} className={styles.iaOpcao}>
        <Choice type="radio" name="publico" value={indice} checked={escolhida === indice} onChange={() => setEscolhida(indice)} />
        <span>
          <strong>{sugestao.titulo}</strong>
          <span className={styles.ajuda}>{sugestao.descricao}</span>
          <span className={styles.iaDetalhes}>{ROTULOS.map(([campo, rotulo]) => sugestao[campo] && <span key={campo}><span className={styles.ajuda}>{rotulo}</span><span>{sugestao[campo]}</span></span>)}</span>
        </span>
      </label>)}
    </fieldset>}
  </PainelSobrepostoCrm>
}
