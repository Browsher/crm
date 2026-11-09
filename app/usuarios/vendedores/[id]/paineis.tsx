'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef, useState } from 'react'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { HistoricoComercial } from '@/src/components/crm/historico-comercial'
import { MenuPainelCrm } from '@/src/components/crm/menu-painel'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { Button } from '@/src/components/ui/button'
import { Dialog } from '@/src/components/ui/dialog'
import type { EmpresaDoVendedor } from '@/src/features/gestao/perfil-vendedor'
import { formatarCnpj } from '@/src/lib/empresa-apresentacao'
import type { EventoHistoricoComercial, FiltroHistoricoComercial } from '@/src/lib/historico-comercial'
import { urlPerfilUsuario, type RecorteUsuarios } from '@/src/lib/recorte-usuarios'
import styles from './perfil.module.css'

type Consulta = 'empresas' | 'atendimentos'
type Props = {
  vendedorId: string
  nome: string
  recorte: RecorteUsuarios
  empresas: readonly EmpresaDoVendedor[]
  eventos: readonly EventoHistoricoComercial[]
  pagina: number
  totalEmpresas: number
  porPagina: number
}

function ControlePagina({ href, children }: { href?: string; children: string }) {
  return href
    ? <Button asChild size="sm" variant="outline"><Link href={href} scroll={false}>{children}</Link></Button>
    : <Button type="button" size="sm" variant="outline" disabled>{children}</Button>
}

export function PaineisPerfil({ vendedorId, nome, recorte, empresas, eventos, pagina, totalEmpresas, porPagina }: Props) {
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [filtro, setFiltro] = useState<FiltroHistoricoComercial>('todos')
  const [expandidos, setExpandidos] = useState(() => new Set<string>())
  const gatilho = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLElement>(null)
  const intervalo = useRef<HTMLParagraphElement>(null)
  const paginaAnterior = useRef(pagina)

  useLayoutEffect(() => {
    const mudouPagina = paginaAnterior.current !== pagina
    paginaAnterior.current = pagina
    if (!mudouPagina || !lista.current) return
    const corpo = lista.current.closest<HTMLElement>('[data-painel-corpo]')
    if (corpo) corpo.scrollTop = 0
    const alvo = intervalo.current ?? lista.current
    alvo.focus({ preventScroll: true })
  }, [pagina])

  function abrir(alvo: Consulta, botao: HTMLButtonElement) {
    gatilho.current = botao
    setConsulta(alvo)
  }

  const paginas = Math.ceil(totalEmpresas / porPagina)
  const paginaVazia = empresas.length === 0 && totalEmpresas > 0
  const endereco = (p: number) => urlPerfilUsuario(vendedorId, recorte, p)
  const primeiro = (pagina - 1) * porPagina + 1
  const ultimo = primeiro + empresas.length - 1
  const rodape = consulta === 'empresas' && paginas > 1 && !paginaVazia ? <nav aria-label="Páginas das empresas" className={styles.paginacao}>
    <p ref={intervalo} tabIndex={-1} role="status">{primeiro.toLocaleString('pt-BR')}–{ultimo.toLocaleString('pt-BR')} de {totalEmpresas.toLocaleString('pt-BR')} empresas · Página {pagina} de {paginas}</p>
    <div>
      <ControlePagina href={pagina > 1 ? endereco(pagina - 1) : undefined}>Anterior</ControlePagina>
      <ControlePagina href={pagina < paginas ? endereco(pagina + 1) : undefined}>Próxima</ControlePagina>
    </div>
  </nav> : undefined

  return <>
    <div className={styles.consultas}>
      <MenuPainelCrm rotulo="Consultas do perfil" itens={[
        { id: 'perfil-empresas', titulo: 'Empresas', descricao: 'Empresas vinculadas e próximos passos', aoAbrir: botao => abrir('empresas', botao) },
        { id: 'perfil-atendimentos', titulo: 'Atendimentos', descricao: 'Linha do tempo do vendedor', aoAbrir: botao => abrir('atendimentos', botao) },
      ]} />
    </div>
    <Dialog open={consulta !== null}>
      {consulta && <PainelSobrepostoCrm titulo={consulta === 'empresas' ? 'Empresas do vendedor' : 'Últimos atendimentos'}
        descricao={<span className={styles.nomeVendedor}>{nome}</span>} aoFechar={() => setConsulta(null)} className={styles.painel} rodape={rodape}
        onCloseAutoFocus={evento => {
          evento.preventDefault()
          if (gatilho.current?.isConnected) gatilho.current.focus({ preventScroll: true })
        }}>
        {consulta === 'empresas' ? <section aria-label="Empresas desta página" ref={lista} tabIndex={0} className={styles.empresas}>
          {empresas.map(empresa => <article key={empresa.id} aria-labelledby={'perfil-empresa-' + empresa.id} className={styles.empresa}>
            <h3 id={'perfil-empresa-' + empresa.id}>{empresa.nome}</h3>
            <p className={styles.cnpj}>CNPJ {empresa.cnpj ? formatarCnpj(empresa.cnpj) : 'não informado'}</p>
            <dl>
              <div><dt>Próximo retorno</dt><dd>{empresa.retorno
                ? <time dateTime={empresa.retorno}>{empresa.retorno.split('-').reverse().join('/')}</time> : 'Sem retorno agendado'}</dd></div>
              <div><dt>Próximo passo</dt><dd>{empresa.proximoPasso ?? 'Não registrado'}</dd></div>
            </dl>
          </article>)}
          {empresas.length === 0 && <EstadoVazio nivelTitulo={3} titulo={paginaVazia ? 'Nenhuma empresa nesta página' : 'Nenhuma empresa vinculada'}
            descricao="As empresas vinculadas ao vendedor aparecem aqui." />}
          {paginaVazia && <ControlePagina href={endereco(1)}>Voltar para a primeira página</ControlePagina>}
        </section> : <>
          <p className={styles.limite}>Até 20 registros, incluindo empresas atendidas anteriormente.</p>
          {eventos.length === 0 ? <EstadoVazio nivelTitulo={3} titulo="Nenhum atendimento registrado"
            descricao="Os últimos atendimentos deste vendedor aparecem aqui." />
            : <HistoricoComercial eventos={eventos} mostrarEmpresa controleFiltro={{ valor: filtro, aoMudar: setFiltro }}
              controleExpansao={{ valor: expandidos, aoMudar: setExpandidos }} />}
        </>}
      </PainelSobrepostoCrm>}
    </Dialog>
  </>
}
