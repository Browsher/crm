'use client'

import { useCallback, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { MapPin, Sparkles } from 'lucide-react'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { Alert } from '@/src/components/ui/alert'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Choice } from '@/src/components/ui/choice'
import { Dialog, DialogTrigger } from '@/src/components/ui/dialog'
import { Textarea } from '@/src/components/ui/textarea'
import { LIMITE_DESCRICAO_IA, type PublicoSugerido, type RegiaoSugerida, type ResultadoAssistente, type SugestoesBusca } from '@/src/lib/assistente-ia'
import styles from './assistente-ia-busca.module.css'

const ROTULO = 'Sugerir filtros com IA'

export function AssistenteIaEmBreve() {
  return <div className={styles.emBreve}>
    <Button type="button" variant="outline" size="sm" disabled>
      <Sparkles aria-hidden="true" /><span>{ROTULO}</span>
    </Button>
    <Badge variant="outline">Em breve</Badge>
  </div>
}

type Props<T extends PublicoSugerido> = {
  bloqueado: boolean
  contexto?: ReactNode
  orientacao: string
  informarEdicao: (edicao: { alterado: boolean; pendente: boolean; fechar: () => void } | null) => void
  pedirFechar: () => void
  gerarAcao: (descricao: string) => Promise<ResultadoAssistente<T>>
  detalhes: (sugestao: T) => { rotulo: string; valor: ReactNode }[]
  aoAplicar: (sugestao: T, regiao?: RegiaoSugerida) => void
}

export function AssistenteIaBusca<T extends PublicoSugerido>(props: Props<T>) {
  const [aberto, setAberto] = useState(false)
  const fechar = useCallback(() => setAberto(false), [])

  return <Dialog open={aberto} onOpenChange={valor => valor ? setAberto(true) : props.pedirFechar()}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="sm" disabled={props.bloqueado}>
        <Sparkles aria-hidden="true" /><span>{ROTULO}</span>
      </Button>
    </DialogTrigger>
    {aberto && <EditorAssistente {...props} fechar={fechar}
      aoAplicar={(sugestao, regiao) => { props.aoAplicar(sugestao, regiao); fechar() }} />}
  </Dialog>
}

function EditorAssistente<T extends PublicoSugerido>({
  contexto, orientacao, fechar, informarEdicao, pedirFechar, gerarAcao, detalhes, aoAplicar,
}: Props<T> & { fechar: () => void }) {
  const [descricao, setDescricao] = useState('')
  const [dados, setDados] = useState<SugestoesBusca<T> | null>(null)
  const [escolhida, setEscolhida] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)
  const enviando = useRef(false)
  const grupo = useId()
  const alterado = Boolean(descricao.trim())

  useLayoutEffect(() => {
    informarEdicao({ alterado, pendente, fechar })
    return () => informarEdicao(null)
  }, [alterado, pendente, fechar, informarEdicao])

  async function gerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    // O portal separa os formulários no DOM, mas o evento React sobe até o formulário de origem.
    evento.stopPropagation()
    if (enviando.current || !descricao.trim()) return
    enviando.current = true
    setPendente(true)
    setDados(null)
    setErro(null)
    try {
      const resultado = await gerarAcao(descricao)
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
  return <PainelSobrepostoCrm titulo={ROTULO}
    descricao={<><span>Descreva seu produto e escolha um público para prospectar.</span>{contexto && <><br />{contexto}</>}</>}
    aoFechar={pedirFechar} fecharBloqueado={pendente} ocupado={pendente} rodape={<div className={styles.rodape}>
      <span className="sr-only" role="status">{pendente ? 'Gerando sugestões.' : ''}</span>
      <span className={styles.ajuda}>{orientacao}</span>
      <Button type="button" disabled={pendente || !atual} onClick={() => { if (atual) aoAplicar(atual, dados?.regiao) }}>Aplicar filtros</Button>
    </div>}>
    <form className={styles.formulario} onSubmit={gerar}>
      <label>O que você quer vender?
        <Textarea name="descricao" rows={2} maxLength={LIMITE_DESCRICAO_IA} value={descricao} required disabled={pendente}
          placeholder="Ex.: Quero vender câmeras Wi-Fi no Brás, em São Paulo."
          onChange={evento => { setDescricao(evento.target.value); setDados(null); setErro(null) }} />
      </label>
      <div className={styles.gerar}><Button type="submit" variant="outline" disabled={pendente || !descricao.trim()}>
        <Sparkles aria-hidden="true" /><span>{pendente ? 'Gerando sugestões…' : 'Gerar sugestões'}</span>
      </Button></div>
    </form>
    {erro && <Alert role="alert" variant="danger">{erro}</Alert>}
    {dados && <fieldset className={styles.sugestoes}>
      <legend>Sugestões de público</legend>
      <p className={styles.ajuda} role="status">{dados.sugestoes.length} {dados.sugestoes.length === 1 ? 'opção disponível' : 'opções disponíveis'}. Escolha uma para preencher o formulário.</p>
      {dados.regiao && <div className={styles.regiao}>
        <MapPin aria-hidden="true" size={16} />
        <span>Região</span>
        <strong>{dados.regiao.bairro || 'Cidade inteira'}, {dados.regiao.cidade}/{dados.regiao.uf}</strong>
      </div>}
      {dados.sugestoes.map((sugestao, indice) => <label key={indice} className={styles.opcao}>
        <Choice type="radio" name={grupo} value={indice} checked={escolhida === indice} onChange={() => setEscolhida(indice)} />
        <span>
          <strong>{sugestao.titulo}</strong>
          <span className={styles.ajuda}>{sugestao.descricao}</span>
          <span className={styles.detalhes}>{detalhes(sugestao).map(({ rotulo, valor }) => <span key={rotulo}><span className={styles.ajuda}>{rotulo}</span><span>{valor}</span></span>)}</span>
        </span>
      </label>)}
    </fieldset>}
  </PainelSobrepostoCrm>
}
