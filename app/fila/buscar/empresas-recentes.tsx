'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, MapPin } from 'lucide-react'
import type { EmpresaPessoal } from '@/src/lib/prospeccao-pessoal'
import { formatarCnpj } from '@/src/lib/empresa-apresentacao'
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
function regiao(e: EmpresaPessoal) {
  return [e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Localização não informada'
}
function recebido(entrada: string) {
  const data = new Date(entrada)
  return Number.isNaN(data.getTime()) ? 'Data não informada' : dataRecebida.format(data)
}
function abertura(data: string | null) {
  return data ? data.slice(0, 10).split('-').reverse().join('/') : 'Não informada'
}
export function EmpresasBancoRecentes({ empresas }: { empresas: EmpresaPessoal[] }) {
  const recentes = empresas.slice(0, 11)
  const total = recentes.length + 1
  const tituloId = useId(), gradeId = useId()
  const tema = useTemaCrm()
  const grade = useRef<HTMLDivElement>(null)
  const gatilho = useRef<HTMLButtonElement | null>(null)
  const secao = useRef<HTMLElement>(null)
  const [pagina, setPagina] = useState({ inicio: 0, quantidade: 3 })
  const [selecionada, setSelecionada] = useState<EmpresaPessoal | null>(null)
  const inicio = Math.min(pagina.inicio, Math.floor((total - 1) / pagina.quantidade) * pagina.quantidade)
  const fim = Math.min(inicio + pagina.quantidade, total)
  useEffect(() => {
    const observador = new ResizeObserver(([medida]) => {
      if (!medida || medida.contentRect.width <= 0) return
      const quantidade = medida.contentRect.width > 670 ? 3 : medida.contentRect.width > 480 ? 2 : 1
      setPagina(atual => atual.quantidade === quantidade ? atual : { inicio: Math.floor(atual.inicio / quantidade) * quantidade, quantidade })
    })
    if (grade.current) observador.observe(grade.current)
    return () => observador.disconnect()
  }, [])
  function mover(delta: number) {
    setPagina(atual => ({ ...atual, inicio: Math.max(0, Math.min(inicio + delta * atual.quantidade, Math.floor((total - 1) / atual.quantidade) * atual.quantidade)) }))
  }
  return <Dialog open={selecionada !== null} onOpenChange={aberto => { if (!aberto) setSelecionada(null) }}>
    <section ref={secao} tabIndex={-1} className={styles.secao} aria-labelledby={tituloId} aria-roledescription="carrossel">
      <header className={styles.cabecalho}>
        <div><h2 id={tituloId}>Todas as minhas empresas</h2><p>As mais recentes do Banco de empresas.</p></div>
        <div role="group" aria-label="Navegação das empresas recentes" className={styles.navegacao} onKeyDown={e => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault(); mover(e.key === 'ArrowLeft' ? -1 : 1)
        }}>
          <span className={styles.contagem} aria-live="polite" aria-atomic="true">{inicio + 1}–{fim} de {total}</span>
          <Button type="button" variant="outline" size="icon" aria-label="Empresas anteriores" aria-controls={gradeId} disabled={inicio === 0} onClick={() => mover(-1)}><ArrowLeft aria-hidden="true" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Próximas empresas" aria-controls={gradeId} disabled={fim === total} onClick={() => mover(1)}><ArrowRight aria-hidden="true" /></Button>
        </div>
      </header>
      {recentes.length === 0 && <p className={styles.vazio}>Suas empresas importadas aparecerão aqui.</p>}
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
              <h3 className={styles.nome} title={e.nome}>{limitar(e.nome, 36)}</h3>
            </div>
            <div className={styles.metadados}>
              <div><span className={styles.rotulo}>Grupo de origem</span><p className={styles.linha} data-grupo-origem title={e.grupoOrigem || undefined}>{limitar(e.grupoOrigem || 'Grupo não informado', 40)}</p></div>
              <p className={`${styles.linha} ${styles.local}`} title={regiao(e)}><MapPin aria-hidden="true" /><span>{regiao(e)}</span></p>
              <p className={styles.recebido}>Recebida em <time dateTime={e.entrada}>{recebido(e.entrada)}</time></p>
            </div>
            <Button type="button" variant="outline" aria-label={`Ver empresa: ${e.nome}`} onClick={evento => { gatilho.current = evento.currentTarget; setSelecionada(e) }}>Ver empresa</Button>
          </Card>
        })}
      </div>
    </section>
    {selecionada && <DialogContent theme={tema} className={styles.dialogo} onCloseAutoFocus={evento => { evento.preventDefault(); (gatilho.current?.isConnected ? gatilho.current : secao.current)?.focus() }}>
      <DialogHeader><DialogTitle>{selecionada.nome}</DialogTitle><DialogDescription>Informações da empresa importada para sua prospecção.</DialogDescription></DialogHeader>
      <div className={styles.detalhes}>
        <Card className={styles.detalheCard}><h3>Origem e recebimento</h3><dl><div><dt>Grupo de origem</dt><dd>{selecionada.grupoOrigem || 'Grupo não informado'}</dd></div><div><dt>Recebida em</dt><dd>{recebido(selecionada.entrada)}</dd></div><div><dt>Nicho</dt><dd>{selecionada.nichos.join(', ') || 'Não informado'}</dd></div></dl></Card>
        <Card className={styles.detalheCard}><h3>Dados da empresa</h3><dl><div><dt>CNPJ</dt><dd>{formatarCnpj(selecionada.cnpj)}</dd></div><div><dt>Porte</dt><dd>{selecionada.porte || 'Não informado'}</dd></div><div><dt>Abertura</dt><dd>{abertura(selecionada.abertura)}</dd></div><div><dt>Localização</dt><dd>{regiao(selecionada)}</dd></div><div><dt>CEP</dt><dd>{selecionada.cep || 'Não informado'}</dd></div></dl></Card>
      </div>
      <Button asChild><Link href={`/fila/localizar/${selecionada.id}?${new URLSearchParams({ pessoal: JSON.stringify({ origem: 'banco' }) })}`}>Abrir ficha completa</Link></Button>
    </DialogContent>}
  </Dialog>
}
