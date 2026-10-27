'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Building2, MapPin } from 'lucide-react'
import type { EmpresaBancoRecente } from '@/src/lib/empresas-banco-recentes'
import { lerEmpresaBuscaAcao } from '@/app/empresas/busca/detalhe-acao'
import popup from '@/src/components/crm/busca-dialogo.module.css'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import styles from './empresas-recentes.module.css'

const destino = '/fila/localizar?origem=banco'
const dataRecebida = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })
function limitar(texto: string, maximo: number) {
  const letras = Array.from(texto)
  return letras.length > maximo ? letras.slice(0, maximo - 1).join('') + '…' : texto
}
function regiao(e: EmpresaBancoRecente) {
  return [e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Localização não informada'
}
function recebido(entrada: string) {
  const data = new Date(entrada)
  return Number.isNaN(data.getTime()) ? 'Data não informada' : dataRecebida.format(data)
}
export function EmpresasBancoRecentes({ empresas }: { empresas: EmpresaBancoRecente[] }) {
  const recentes = empresas.slice(0, 11)
  const total = recentes.length + 1
  const tituloId = useId(), gradeId = useId()
  const tema = useTemaCrm()
  const grade = useRef<HTMLDivElement>(null)
  const gatilho = useRef<HTMLButtonElement | null>(null)
  const secao = useRef<HTMLElement>(null)
  const [amplo, setAmplo] = useState(false)
  const [pagina, setPagina] = useState({ inicio: 0, quantidade: 3 })
  const [selecionada, setSelecionada] = useState<EmpresaBancoRecente | null>(null)
  const [conteudo, setConteudo] = useState<ReactNode>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const pedido = useRef(0)
  async function carregar(e: EmpresaBancoRecente) {
    const atual = ++pedido.current
    setConteudo(null); setErro(''); setCarregando(true)
    try {
      const r = await lerEmpresaBuscaAcao(e.buscaId, e.cnpj)
      if (atual !== pedido.current) return
      if (r.ok) setConteudo(r.conteudo)
      else setErro(r.erro)
    } catch {
      if (atual === pedido.current) setErro('Não foi possível carregar a empresa. Tente novamente.')
    } finally {
      if (atual === pedido.current) setCarregando(false)
    }
  }
  function fechar() { pedido.current++; setSelecionada(null); setConteudo(null); setErro(''); setCarregando(false) }
  const inicio = Math.min(pagina.inicio, Math.floor((total - 1) / pagina.quantidade) * pagina.quantidade)
  const fim = Math.min(inicio + pagina.quantidade, total)
  useEffect(() => {
    const observador = new ResizeObserver(([medida]) => {
      if (!medida || medida.contentRect.width <= 0) return
      setAmplo(medida.contentRect.width >= 1120)
      const quantidade = medida.contentRect.width > 670 ? 3 : medida.contentRect.width > 480 ? 2 : 1
      setPagina(atual => atual.quantidade === quantidade ? atual : { inicio: Math.floor(atual.inicio / quantidade) * quantidade, quantidade })
    })
    if (grade.current) observador.observe(grade.current)
    return () => observador.disconnect()
  }, [])
  function mover(delta: number) {
    setPagina(atual => ({ ...atual, inicio: Math.max(0, Math.min(inicio + delta * atual.quantidade, Math.floor((total - 1) / atual.quantidade) * atual.quantidade)) }))
  }
  return <Dialog open={selecionada !== null} onOpenChange={aberto => { if (!aberto) fechar() }}>
    <section ref={secao} tabIndex={-1} className={styles.secao} aria-labelledby={tituloId} aria-roledescription="carrossel">
      <header className={styles.cabecalho}>
        <div><h2 id={tituloId}>Últimas buscas</h2><p>Empresas encontradas nas suas pesquisas mais recentes.</p></div>
        <div role="group" aria-label="Navegação das empresas recentes" className={styles.navegacao} onKeyDown={e => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault(); mover(e.key === 'ArrowLeft' ? -1 : 1)
        }}>
          <span className={styles.contagem} aria-live="polite" aria-atomic="true">{inicio + 1}–{fim} de {total}</span>
          <Button type="button" variant="outline" size="icon" aria-label="Empresas anteriores" aria-controls={gradeId} disabled={inicio === 0} onClick={() => mover(-1)}><ArrowLeft aria-hidden="true" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Próximas empresas" aria-controls={gradeId} disabled={fim === total} onClick={() => mover(1)}><ArrowRight aria-hidden="true" /></Button>
        </div>
      </header>
      {recentes.length === 0 && <p className={styles.vazio}>As empresas encontradas nas suas buscas aparecerão aqui.</p>}
      <div ref={grade} id={gradeId} className={styles.grade}>
        {Array.from({ length: fim - inicio }, (_, posicao) => {
          const indice = inicio + posicao
          const e = recentes[indice]
          if (!e) return <Card key="todas" className={`${styles.card} ${styles.todas}`}>
            <Building2 aria-hidden="true" className={styles.iconeTodas} />
            <div><h3>Continue procurando</h3><p>Veja suas empresas do banco e use os filtros para localizar uma delas.</p></div>
            <Button asChild variant="outline"><Link href={destino}>Ver todas buscas</Link></Button>
          </Card>
          return <Card key={e.id} className={styles.card} data-empresa-recente={e.id} role="group" aria-label={`Empresa ${indice + 1} de ${recentes.length}`}>
            <div className={styles.identidade}>
              <div className={styles.marca}><Building2 aria-hidden="true" />{e.situacao === 'cliente' && <Badge variant="success">Cliente</Badge>}</div>
              <h3 className={styles.nome} title={e.nome}>{limitar(e.nome, amplo ? 80 : 36)}</h3>
            </div>
            <div className={styles.metadados}>
              <div><span className={styles.rotulo}>Grupo de origem</span><p className={styles.linha} data-grupo-origem title={e.grupoOrigem || undefined}>{limitar(e.grupoOrigem || 'Grupo não informado', amplo ? 120 : 40)}</p></div>
              <p className={`${styles.linha} ${styles.local}`} title={e.endereco || regiao(e)}><MapPin aria-hidden="true" /><span>{amplo && e.endereco ? e.endereco : regiao(e)}</span></p>
              {e.atividade && <p className={styles.desktopAtividade} title={e.atividade}>Nicho: {e.atividade}</p>}
              <div className={styles.desktopDados} data-desktop-dados>
                <div><span>Porte</span><p title={e.porte || undefined}>{({ ME: 'Microempresa', MEI: 'Microempreendedor individual', EPP: 'Pequena empresa', DEMAIS: 'Demais portes' } as Record<string, string>)[e.porte || ''] || e.porte || 'Não informado'}</p></div>
                <div><span>Abertura</span><p>{e.abertura ? e.abertura.slice(0, 10).split('-').reverse().join('/') : 'Não informada'}</p></div>
                <div><span>Telefone</span><p>{e.comTelefone ? 'Informado' : 'Não informado'}</p></div>
                <div><span>E-mail</span><p>{e.comEmail ? 'Informado' : 'Não informado'}</p></div>
              </div>
              <p className={styles.recebido}>Recebida em <time dateTime={e.entrada}>{recebido(e.entrada)}</time></p>
            </div>
            <Button type="button" variant="outline" aria-label={`Ver empresa: ${e.nome}`} onClick={evento => { gatilho.current = evento.currentTarget; setSelecionada(e); void carregar(e) }}>Ver empresa</Button>
          </Card>
        })}
      </div>
    </section>
    {selecionada && <DialogContent theme={tema} className={popup.dialogo} onCloseAutoFocus={evento => { evento.preventDefault(); (gatilho.current?.isConnected ? gatilho.current : secao.current)?.focus() }}>
      <DialogHeader className={popup.cabecalho}><DialogTitle>{selecionada.nome}</DialogTitle><DialogDescription>Grupo de origem: {selecionada.grupoOrigem || 'Grupo não informado'}. Confira os dados salvos desta busca.</DialogDescription></DialogHeader>
      <div className={popup.corpo} aria-busy={carregando}>
        {carregando && <p role="status">Carregando empresa…</p>}
        {erro && <div className="grid gap-3"><p role="alert">{erro}</p><Button type="button" variant="outline" onClick={() => void carregar(selecionada)}>Tentar novamente</Button></div>}
        {conteudo}
        {selecionada.empresaId && <Button asChild variant="outline"><Link href={`/fila/localizar/${selecionada.empresaId}?${new URLSearchParams({ pessoal: JSON.stringify({ origem: 'banco' }) })}`}>Abrir ficha completa</Link></Button>}
      </div>
    </DialogContent>}
  </Dialog>
}
