'use client'

import { Suspense, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, CalendarDays, Columns3, FolderOpen, LayoutDashboard, LogOut, Menu, MessageCircle, PanelLeftClose, PanelLeftOpen, Palette, Search, Users, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/src/components/ui/sheet'
import { TemaCrmContext, useControleTemaCrm, type TemaCrm } from './tema'
import { CaminhoCrm } from './caminho'
import styles from './shell.module.css'

const TITULO = { funil: 'Funil', fila: 'Prospecção', carteira: 'Carteira', 'meu-dia': 'Meu dia', empresas: 'Empresas', usuarios: 'Usuários', gestao: 'Gestão', whatsapp: 'WhatsApp', design: 'Design system' } as const
const TEMA = { funil: 'Tema do Funil', fila: 'Tema da Fila', carteira: 'Tema da Carteira', 'meu-dia': 'Tema do Meu dia', empresas: 'Tema de Empresas', usuarios: 'Tema de Usuários', gestao: 'Tema da Gestão', whatsapp: 'Tema do WhatsApp', design: 'Tema do design system' } as const
const vendedor: [string, string, LucideIcon][] = [['/meu-dia', 'Meu dia', CalendarDays], ['/fila', 'Prospecção', Search], ['/funil', 'Funil', Columns3], ['/carteira', 'Carteira', Wallet]]
const gestor: [string, string, LucideIcon][] = [['/gestao', 'Início', LayoutDashboard], ['/empresas', 'Empresas', Building2], ['/empresas/google', 'Coletas do Google', CalendarDays], ['/empresas/grupos', 'Listas', FolderOpen], ['/usuarios', 'Usuários', Users], ['/whatsapp', 'WhatsApp', MessageCircle], ['/design', 'Design system', Palette]]

export function ShellCrm({ children, nome, papel, area }: { children: ReactNode; nome: string; papel: 'gestor' | 'vendedor'; area: keyof typeof TITULO }) {
  const { tema, definirTema } = useControleTemaCrm()
  const [aberto, setAberto] = useState(false)
  const [recolhido, setRecolhido] = useState(false)
  const pathname = usePathname()
  const grupos = area === 'empresas' && pathname?.startsWith('/empresas/grupos')
  const google = area === 'empresas' && pathname?.startsWith('/empresas/google')
  const marca = <Link href="/" className={styles.marca} aria-label="CRM"><span aria-hidden="true"><Columns3 size={21} /></span><div className={styles.nomeMarca}><strong>CRM</strong><small>Gestão comercial</small></div></Link>
  const navegacao = <>
    <p className={styles.legendaMenu}>{papel === 'gestor' ? 'Gestão' : 'Área comercial'}</p>
    <nav aria-label="Navegação do CRM" onClick={() => setAberto(false)}>
      {(papel === 'gestor' ? gestor : vendedor).map(([href, rotulo, Icone]) => {
        const atual = google ? href === '/empresas/google' : grupos ? href === '/empresas/grupos' : href === `/${area}`
        return <Link key={href} href={href} aria-current={atual ? 'page' : undefined} title={rotulo}><Icone size={18} aria-hidden="true" /><span className={styles.rotuloMenu}>{rotulo}</span></Link>
      })}
    </nav>
    <form className={styles.saida} action="/sair" method="post"><Button type="submit" variant="ghost" title="Sair"><LogOut size={18} aria-hidden="true" /><span className={styles.rotuloMenu}>Sair</span></Button></form>
  </>
  return <TemaCrmContext.Provider value={tema}>
    <div className={`crm-ui ${styles.shell} ${recolhido ? styles.recolhido : ''}`} data-theme={tema}>
      <a className={styles.skip} href="#conteudo-fila">Ir para o conteúdo</a>
      <aside className={styles.sidebar} id="menu-fila">
        <div className={styles.topoLateral}>{marca}<Button className={styles.recolher} type="button" variant="ghost" size="icon" aria-label={recolhido ? 'Expandir barra lateral' : 'Recolher barra lateral'} aria-expanded={!recolhido} aria-controls="menu-fila" onClick={() => setRecolhido(!recolhido)}>{recolhido ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</Button></div>
        {navegacao}
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <Sheet open={aberto} onOpenChange={setAberto}>
            <SheetTrigger asChild><Button className={styles.menu} variant="ghost" size="icon" aria-label="Menu do CRM"><Menu /></Button></SheetTrigger>
            <SheetContent side="left" className={`crm-ui ${styles.menuMovel}`} data-theme={tema}>
              <SheetTitle className="sr-only">Navegação do CRM</SheetTitle><SheetDescription className="sr-only">Acesse as áreas disponíveis para seu perfil.</SheetDescription>
              <div className={styles.topoLateral}>{marca}</div>{navegacao}
            </SheetContent>
          </Sheet>
          <Suspense fallback={<span className={styles.titulo}>{TITULO[area]}</span>}><CaminhoCrm area={area} titulo={TITULO[area]} /></Suspense>
          <div className={styles.controles}>
            <label className={styles.tema}><span>Tema</span><NativeSelect aria-label={TEMA[area]} value={tema} onChange={e => definirTema(e.target.value as TemaCrm)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></NativeSelect></label>
            <div className={styles.perfil}><span className={styles.avatar} aria-hidden="true">{nome.trim().slice(0, 1).toUpperCase()}</span><div className={styles.identidade}><span className={styles.nome} title={nome}>{nome}</span><small>{papel === 'gestor' ? 'Gestor' : 'Vendedor'}</small></div></div>
          </div>
        </header>
        <div id="conteudo-fila" tabIndex={-1} className={styles.conteudo}>{children}</div>
      </div>
    </div>
  </TemaCrmContext.Provider>
}
