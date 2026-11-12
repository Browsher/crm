'use client'

import { useCallback, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { Alert } from '@/src/components/ui/alert'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Choice } from '@/src/components/ui/choice'
import { Dialog, DialogTrigger } from '@/src/components/ui/dialog'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Textarea } from '@/src/components/ui/textarea'
import { LIMITE_DESCRICAO_IA, type EntradaAssistente, type PublicoSugerido, type RegiaoAssistente, type ResultadoAssistente, type SugestoesBusca } from '@/src/lib/assistente-ia'
import { perfisDoProduto, reconhecerProdutoProspeccao, type ProdutoProspeccao } from '@/src/lib/assistente-ia-catalogo'
import { BuscaProdutoAssistente } from './assistente-ia-produto'
import { linhaRegiaoVazia, PreviaRegioesAssistente, RegioesAssistente, regioesPreenchidas, type LinhaRegiaoAssistente } from './assistente-ia-regioes'
import styles from './assistente-ia-busca.module.css'

const ROTULO = 'Sugerir filtros com IA'
const REFINAMENTO_INICIAL = { publico: '', especialidade: '', detalhes: '' }

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
  regioesAtuais: RegiaoAssistente[]
  limiteRegioes: 1 | 20
  informarEdicao: (edicao: { alterado: boolean; pendente: boolean; fechar: () => void } | null) => void
  pedirFechar: () => void
  gerarAcao: (entrada: EntradaAssistente) => Promise<ResultadoAssistente<T>>
  detalhes: (sugestao: T) => { rotulo: string; valor: ReactNode }[]
  aoAplicar: (sugestao: T, regioes?: RegiaoAssistente[]) => void
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
      aoAplicar={(sugestao, regioes) => { props.aoAplicar(sugestao, regioes); fechar() }} />}
  </Dialog>
}

function EditorAssistente<T extends PublicoSugerido>({
  contexto, orientacao, regioesAtuais, limiteRegioes, fechar, informarEdicao, pedirFechar, gerarAcao, detalhes, aoAplicar,
}: Props<T> & { fechar: () => void }) {
  const [produto, setProduto] = useState<ProdutoProspeccao | null>(null)
  const [outroProduto, setOutroProduto] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [refinar, setRefinar] = useState(false)
  const [refinamento, setRefinamento] = useState(REFINAMENTO_INICIAL)
  const [linhas, setLinhas] = useState<LinhaRegiaoAssistente[]>(() => regioesAtuais.length
    ? regioesAtuais.map((regiao, id) => ({ ...regiao, id, bairros: regiao.bairros.join(', ') }))
    : [linhaRegiaoVazia(0)])
  const [regioesEditadas, setRegioesEditadas] = useState(false)
  const proximaLinha = useRef(regioesAtuais.length || 1)
  const [dados, setDados] = useState<SugestoesBusca<T> | null>(null)
  const [escolhida, setEscolhida] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)
  const enviando = useRef(false)
  const revisao = useRef(0)
  const moverFoco = useRef(false)
  const alvoFoco = useRef<HTMLElement | null>(null)
  const tituloSugestoes = useRef<HTMLLegendElement>(null)
  const definirAlvoFoco = useCallback((elemento: HTMLElement | null) => { alvoFoco.current = elemento }, [])
  const grupo = useId()
  const produtoEntrada = produto ? { sku: produto.sku } : outroProduto && descricao.trim() ? { descricao: descricao.trim() } : null
  const alterado = Boolean(produtoEntrada || regioesEditadas)
  const reconhecido = outroProduto ? reconhecerProdutoProspeccao(descricao) : undefined
  const perfis = produto ? perfisDoProduto(produto) : []
  const publicoEscolhido = perfis.find(perfil => perfil.id === refinamento.publico)
  const especialidades = produto?.especialidades.filter(especialidade => !publicoEscolhido || publicoEscolhido.especialidades.includes(especialidade)) ?? []
  const regioes = regioesPreenchidas(linhas, limiteRegioes)
  const sugerida = dados?.regiao
  const regioesParaAplicar = regioesEditadas ? regioes
    : outroProduto && !regioes.length && sugerida
      ? [{ estado: sugerida.uf, cidade: sugerida.cidade, bairros: sugerida.bairro ? [sugerida.bairro] : [] }]
      : undefined

  useLayoutEffect(() => {
    informarEdicao({ alterado, pendente, fechar })
    return () => informarEdicao(null)
  }, [alterado, pendente, fechar, informarEdicao])

  useLayoutEffect(() => {
    if (moverFoco.current) {
      moverFoco.current = false
      alvoFoco.current?.focus({ preventScroll: true })
    }
  }, [produto, outroProduto])

  useLayoutEffect(() => {
    if (!dados) return
    tituloSugestoes.current?.focus({ preventScroll: true })
    tituloSugestoes.current?.scrollIntoView?.({ block: 'start' })
  }, [dados])

  function invalidar() {
    revisao.current += 1
    setDados(null)
    setErro(null)
  }

  function mudarProduto(proximo: ProdutoProspeccao | null, livre = false) {
    invalidar()
    moverFoco.current = true
    setProduto(proximo)
    setOutroProduto(livre)
    setDescricao('')
    setRefinar(false)
    setRefinamento(REFINAMENTO_INICIAL)
  }

  function mudarPublico(publico: string) {
    const perfil = perfis.find(opcao => opcao.id === publico)
    const especialidade = !perfil || perfil.especialidades.includes(refinamento.especialidade) ? refinamento.especialidade : ''
    setRefinamento(atual => ({ ...atual, publico, especialidade }))
    invalidar()
  }

  async function gerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    // O portal separa os formulários no DOM, mas o evento React sobe até o formulário de origem.
    evento.stopPropagation()
    if (enviando.current || !produtoEntrada) return
    const pedido = revisao.current
    const { publico, especialidade, detalhes } = refinamento
    enviando.current = true
    setPendente(true)
    setDados(null)
    setErro(null)
    try {
      const resultado = await gerarAcao({
        produto: produtoEntrada,
        ...(publico.trim() && { publico: publico.trim() }),
        ...(especialidade && { especialidade }),
        ...(detalhes.trim() && { detalhes: detalhes.trim() }),
        ...((regioes.length > 0 || regioesEditadas) && { regioes }),
      })
      if (pedido !== revisao.current) return
      if (resultado.ok) {
        setDados(resultado.valor)
        setEscolhida(0)
      } else {
        setErro(resultado.motivo)
      }
    } catch {
      if (pedido === revisao.current) {
        setErro('Não foi possível gerar sugestões. Tente novamente ou preencha os critérios manualmente.')
      }
    } finally {
      enviando.current = false
      setPendente(false)
    }
  }

  const atual = dados?.sugestoes[escolhida]
  return <PainelSobrepostoCrm titulo={ROTULO}
    descricao={<><span>Escolha um produto para encontrar públicos para prospectar.</span>{contexto && <><br />{contexto}</>}</>}
    aoFechar={pedirFechar} fecharBloqueado={pendente} ocupado={pendente} rodape={<div className={styles.rodape}>
      <span className="sr-only" role="status">{pendente ? 'Gerando sugestões.' : ''}</span>
      <span className={styles.ajuda}>{orientacao}</span>
      <Button type="button" disabled={pendente || !atual} onClick={() => { if (atual) aoAplicar(atual, regioesParaAplicar) }}>Aplicar filtros</Button>
    </div>}>
    <form className={styles.formulario} onSubmit={gerar}>
      {produto ? <section className={styles.produtoSelecionado}>
        <div><h3 ref={definirAlvoFoco} tabIndex={-1}>{produto.nome} · {produto.sku}</h3><p className={styles.ajuda}>{produto.ficha}</p></div>
        <Button type="button" variant="outline" size="sm" onClick={() => mudarProduto(null)}>Trocar produto</Button>
      </section> : outroProduto ? <div className={styles.buscaProduto}>
        <label>O que você quer vender?
          <Textarea ref={definirAlvoFoco} name="descricao" rows={2} maxLength={LIMITE_DESCRICAO_IA} value={descricao} required
            placeholder="Descreva o produto, sua função ou quem costuma comprar."
            onChange={evento => { setDescricao(evento.target.value); invalidar() }} />
        </label>
        {reconhecido && <Button type="button" variant="outline" size="sm" className={styles.produtoReconhecido} onClick={() => mudarProduto(reconhecido)}>
          Selecionar {reconhecido.nome} · {reconhecido.sku}
        </Button>}
        <Button type="button" variant="ghost" size="sm" onClick={() => mudarProduto(null)}>Escolher no catálogo</Button>
      </div> : <BuscaProdutoAssistente inputRef={definirAlvoFoco} selecionar={mudarProduto} outroProduto={() => mudarProduto(null, true)} />}
      {produtoEntrada && <>
        <RegioesAssistente linhas={linhas} limite={limiteRegioes}
          aoEditar={(id, campo, valor) => {
            const dependentes = limiteRegioes === 1 ? {}
              : campo === 'estado' ? { cidade: '', bairros: '' }
                : campo === 'cidade' ? { bairros: '' } : {}
            setLinhas(atuais => atuais.map(linha => linha.id === id ? { ...linha, ...dependentes, [campo]: valor } : linha))
            setRegioesEditadas(true)
            invalidar()
          }}
          aoRemover={id => {
            setLinhas(atuais => limiteRegioes === 1 ? [linhaRegiaoVazia(id)] : atuais.filter(linha => linha.id !== id))
            setRegioesEditadas(true)
            invalidar()
          }}
          aoAdicionar={() => {
            const id = proximaLinha.current++
            setLinhas(atuais => atuais.length < limiteRegioes ? [...atuais, linhaRegiaoVazia(id)] : atuais)
            invalidar()
          }} />
        <section className={styles.refinar}>
          <h3><Button type="button" variant="ghost" aria-expanded={refinar} aria-controls={grupo + '-refinar'}
            onClick={() => setRefinar(aberto => !aberto)}>Refinar busca<ChevronDown aria-hidden="true" /></Button></h3>
          <div id={grupo + '-refinar'} hidden={!refinar} className={styles.camposRefinamento}>
            {refinar && <>
              {produto ? <label>Público-alvo
                <NativeSelect name="publico" value={refinamento.publico} onChange={evento => mudarPublico(evento.target.value)}>
                  <option value="">Sugerir públicos</option>
                  {perfis.map(perfil => <option key={perfil.id} value={perfil.id}>{perfil.rotulo}</option>)}
                </NativeSelect>
              </label> : <label>Público-alvo (opcional)
                <Input name="publico" value={refinamento.publico} maxLength={100}
                  onChange={evento => mudarPublico(evento.target.value)} />
              </label>}
              {especialidades.length > 0 && <label>Especialidade do negócio
                <NativeSelect name="especialidade" value={refinamento.especialidade} onChange={evento => {
                  const especialidade = evento.target.value
                  setRefinamento(atual => ({ ...atual, especialidade }))
                  invalidar()
                }}>
                  <option value="">Qualquer especialidade</option>
                  {especialidades.map(especialidade => <option key={especialidade}>{especialidade}</option>)}
                </NativeSelect>
              </label>}
              <label>Detalhes da busca (opcional)
                <Textarea name="detalhes" rows={2} maxLength={LIMITE_DESCRICAO_IA} value={refinamento.detalhes}
                  placeholder="Ex.: Prefiro lojas que atendem instaladores."
                  onChange={evento => {
                    const detalhes = evento.target.value
                    setRefinamento(atual => ({ ...atual, detalhes }))
                    invalidar()
                  }} />
              </label>
            </>}
          </div>
        </section>
      </>}
      <div className={styles.gerar}><Button type="submit" variant="outline" disabled={pendente || !produtoEntrada}>
        <Sparkles aria-hidden="true" /><span>{pendente ? 'Gerando sugestões…' : 'Gerar sugestões'}</span>
      </Button></div>
    </form>
    {erro && <Alert role="alert" variant="danger">{erro}</Alert>}
    {dados && <fieldset className={styles.sugestoes}>
      <legend ref={tituloSugestoes} tabIndex={-1}>Sugestões de público</legend>
      <p className={styles.ajuda} role="status">{dados.sugestoes.length} {dados.sugestoes.length === 1 ? 'opção disponível' : 'opções disponíveis'}. Escolha uma para preencher o formulário.</p>
      <PreviaRegioesAssistente regioes={regioesParaAplicar ?? regioes} />
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
