'use client'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { lerDetalhesEmpresaAcao } from '@/app/empresas/busca/detalhe-acao'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import { dataEmpresa, MOTIVOS_INDISPONIBILIDADE } from '@/src/lib/empresa-visual'
import type { ResultadoDetalhesEmpresa } from '@/src/server/empresas/detalhes'
import { Dialog } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardHeader } from '@/src/components/ui/card'
import { EmpresaDetalhes, type GrupoEmpresa } from './empresa-detalhes'
import { MenuPainelCrm } from './menu-painel'
import { PainelLateralCrm, PainelSobrepostoCrm } from './painel-lateral'
import styles from './empresa.module.css'

type Props = { referencia: ReferenciaEmpresa; aoFechar: () => void; rotuloFechar?: 'Fechar' | 'Voltar' }

// A chave desmonta a seleção anterior antes do próximo paint e invalida seu efeito.
function chaveReferencia(ref: ReferenciaEmpresa) {
  return ref.tipo === 'cadastro' ? 'cadastro:'+ref.empresaId : 'busca:'+ref.buscaId+':'+ref.cnpj
}

export function EmpresaDialogo({ referencia, aoFechar, origem }: Props & { origem?: HTMLElement }) {
  const [gatilho] = useState(() => origem ?? (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null))
  const [selecao, setSelecao] = useState<{ chave: string; grupo: GrupoEmpresa } | null>(null)
  const chave = chaveReferencia(referencia)
  const grupo = selecao?.chave === chave ? selecao.grupo : null
  return <Dialog open>
    <PainelSobrepostoCrm titulo="Ver empresa" descricao="Dados salvos da empresa selecionada."
      rotuloFechar={grupo ? 'Voltar' : 'Fechar'} aoFechar={grupo ? () => setSelecao(null) : aoFechar}
      onCloseAutoFocus={evento => { evento.preventDefault(); if (gatilho?.isConnected) gatilho.focus({ preventScroll: true }) }}>
      <ConteudoConsultaEmpresa referencia={referencia} grupo={grupo} aoAbrir={grupo => setSelecao({ chave, grupo })} />
    </PainelSobrepostoCrm>
  </Dialog>
}

type NavegacaoEmpresa = { grupo: GrupoEmpresa | null; aoAbrir: (grupo: GrupoEmpresa) => void }

export function ConteudoConsultaEmpresa({ referencia, ...navegacao }: { referencia: ReferenciaEmpresa } & NavegacaoEmpresa) {
  return <ConteudoEmpresa key={chaveReferencia(referencia)} referencia={referencia} navegacao={navegacao} />
}

export function DadosEmpresaPainel({ referencia, aoFechar, rotuloFechar, rodapeComercial }: Props & { rodapeComercial?: ReactNode }) {
  return <PainelLateralCrm key={chaveReferencia(referencia)} titulo="Dados da empresa" aoFechar={aoFechar} rotuloFechar={rotuloFechar} className={styles.lateral} rodape={rodapeComercial ?? null}>
    <ConteudoEmpresa referencia={referencia} />
  </PainelLateralCrm>
}

const origens = { google: 'Google', banco: 'Banco de empresas', legado: 'Legado' }
const grupos = {
  contato: 'Contato e localização',
  cadastro: 'Cadastro e origem',
  atividades: 'Atividades e sócios',
} satisfies Record<GrupoEmpresa, string>

function ConteudoEmpresa({ referencia, navegacao }: { referencia: ReferenciaEmpresa; navegacao?: NavegacaoEmpresa }) {
  const [resultado, setResultado] = useState<ResultadoDetalhesEmpresa | null>(null)
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [gatilhoGrupo, setGatilhoGrupo] = useState<HTMLButtonElement | null>(null)
  const idMenu = useId()
  const tituloGrupo = useRef<HTMLHeadingElement>(null)
  const grupo = navegacao?.grupo
  useLayoutEffect(() => {
    const alvo = grupo ? tituloGrupo.current : gatilhoGrupo
    if (!alvo?.isConnected) return
    const corpo = alvo.closest<HTMLElement>('[data-painel-corpo]')
    if (corpo) corpo.scrollTop = 0
    alvo.focus({ preventScroll: true })
  }, [grupo, gatilhoGrupo])
  const tipo = referencia.tipo, id = referencia.tipo === 'cadastro' ? referencia.empresaId : referencia.buscaId, cnpj = referencia.tipo === 'busca' ? referencia.cnpj : ''
  useEffect(() => {
    let atual = true
    lerDetalhesEmpresaAcao(tipo === 'cadastro' ? { tipo, empresaId: id } : { tipo, buscaId: id, cnpj }).then(r => { if (atual) setResultado(r) }, () => { if (atual) setErro(true) })
    return () => { atual = false }
  }, [tipo, id, cnpj, tentativa])
  return <div className={`${styles.lateral} ${styles.dadosLateral}`} aria-busy={!resultado && !erro}>
    {!resultado && !erro && <p role="status">Carregando empresa…</p>}
    {(erro || resultado?.ok === false) && <div><p role="alert">{erro ? 'Não foi possível carregar a empresa. Tente novamente.' : 'Esta empresa não está disponível para você.'}</p>{erro && <Button type="button" variant="outline" onClick={() => { setErro(false); setResultado(null); setTentativa(t => t + 1) }}>Tentar novamente</Button>}</div>}
    {resultado?.ok && <>
      <h3 className={styles.nome}>{resultado.dados.nome}</h3>
      {resultado.dados.motivoIndisponibilidade && <p className={styles.muted}>{MOTIVOS_INDISPONIBILIDADE[resultado.dados.motivoIndisponibilidade]}</p>}
      {navegacao && <div hidden={Boolean(grupo)}>
        <MenuPainelCrm rotulo="Dados da empresa" itens={(Object.keys(grupos) as GrupoEmpresa[]).map(id => ({
          id: idMenu + '-' + id, titulo: grupos[id],
          aoAbrir: botao => { setGatilhoGrupo(botao); navegacao.aoAbrir(id) },
        }))} />
      </div>}
      {grupo && <h4 ref={tituloGrupo} tabIndex={-1}>{grupos[grupo]}</h4>}
      {(!navegacao || grupo) && <EmpresaDetalhes empresa={resultado.dados} contatosPrimeiro grupo={grupo ?? undefined} />}
      {(!navegacao || grupo === 'cadastro') && <Card><CardHeader><h4>Origem</h4></CardHeader><CardContent><dl className={styles.dados}>
        <div><dt>Encontrada em</dt><dd>{resultado.dados.origens.map(o => origens[o]).join(', ') || 'Não informado'}</dd></div>
        <div><dt>Recebida em</dt><dd>{dataEmpresa(resultado.dados.recebidaEm)}</dd></div>
      </dl></CardContent></Card>}
    </>}
  </div>
}
