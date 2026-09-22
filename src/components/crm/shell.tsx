'use client'

import { Suspense, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { NativeSelect } from '@/src/components/ui/native-select'
import { TemaCrmContext, type TemaCrm } from './tema'
import styles from './shell.module.css'
import { CaminhoCrm } from './caminho'

const TITULO = { funil: 'Funil', fila: 'Prospecção', carteira: 'Carteira', 'meu-dia': 'Meu dia', empresas: 'Empresas', usuarios: 'Usuários', gestao: 'Gestão', whatsapp: 'WhatsApp' } as const
const TEMA = { funil: 'Tema do Funil', fila: 'Tema da Fila', carteira: 'Tema da Carteira', 'meu-dia': 'Tema do Meu dia', empresas: 'Tema de Empresas', usuarios: 'Tema de Usuários', gestao: 'Tema da Gestão', whatsapp: 'Tema do WhatsApp' } as const

const ICONES = {
  inicio: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  empresas: 'M4 21V3h12v18 M8 7h4 M8 11h4 M8 15h4 M16 9h4v12 M2 21h20',
  grupos: 'M3 7V4h6l3 3h9v13H3Z M3 10h18',
  usuarios: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',
  whatsapp: 'M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z',
  dia: 'M4 5h16v16H4Z M8 3v4 M16 3v4 M4 11h16 M8 15h3',
  fila: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  funil: 'M3 4h18l-7 8v8l-4-2v-6Z',
  carteira: 'M3 7h18v14H3Z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3',
  marca: 'm12 3 10 5-10 5L2 8Z M2 12l10 5 10-5 M2 16l10 5 10-5',
  recolher: 'M3 3h18v18H3Z M9 3v18 M16 9l-3 3 3 3',
  expandir: 'M3 3h18v18H3Z M9 3v18 M13 9l3 3-3 3',
  sair: 'M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4',
} as const

function Icone({ nome }: { nome: keyof typeof ICONES }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONES[nome]} /></svg>
}

function ItemMenu({ href, nome, icone, atual }: { href: string; nome: string; icone: keyof typeof ICONES; atual?: boolean }) {
  return <Link href={href} aria-current={atual ? 'page' : undefined} title={nome}><Icone nome={icone} /><span className={styles.rotuloMenu}>{nome}</span></Link>
}

export function ShellCrm({ children, nome, papel, area }: { children: ReactNode; nome: string; papel: 'gestor' | 'vendedor'; area: keyof typeof TITULO }) {
  const [tema, setTema] = useState<TemaCrm>('system')
  const [aberto, setAberto] = useState(false)
  const [recolhido, setRecolhido] = useState(false)
  return <TemaCrmContext.Provider value={tema}>
    <div className={`crm-ui ${styles.shell} ${recolhido ? styles.recolhido : ''}`} data-theme={tema}>
      <a className={styles.skip} href="#conteudo-fila">Ir para o conteúdo</a>
      <aside className={`${styles.sidebar} ${aberto ? styles.aberto : ''}`} id="menu-fila">
        <div className={styles.topoLateral}>
          <Link href="/" className={styles.marca} aria-label="CRM"><span aria-hidden="true"><Icone nome="marca" /></span><div className={styles.nomeMarca}><strong>CRM</strong><small>Gestão comercial</small></div></Link>
          <Button className={styles.recolher} type="button" variant="ghost" size="icon" aria-label={recolhido ? 'Expandir barra lateral' : 'Recolher barra lateral'} aria-expanded={!recolhido} aria-controls="menu-fila" onClick={() => setRecolhido(!recolhido)}><Icone nome={recolhido ? 'expandir' : 'recolher'} /></Button>
        </div>
        <nav aria-label="Navegação do CRM" onClick={() => setAberto(false)}>
          {papel === 'vendedor' && <><ItemMenu href="/meu-dia" nome="Meu dia" icone="dia" atual={area === 'meu-dia'} /><ItemMenu href="/fila" nome="Prospecção" icone="fila" atual={area === 'fila'} /><ItemMenu href="/funil" nome="Funil" icone="funil" atual={area === 'funil'} /><ItemMenu href="/carteira" nome="Carteira" icone="carteira" atual={area === 'carteira'} /></>}
          {papel === 'gestor' && <><ItemMenu href="/gestao" nome="Início" icone="inicio" atual={area === 'gestao'} /><ItemMenu href="/empresas" nome="Empresas" icone="empresas" atual={area === 'empresas'} /><ItemMenu href="/empresas/grupos" nome="Grupos" icone="grupos" /><ItemMenu href="/usuarios" nome="Usuários" icone="usuarios" atual={area === 'usuarios'} /><ItemMenu href="/whatsapp" nome="WhatsApp" icone="whatsapp" atual={area === 'whatsapp'} /></>}
        </nav>
        <form className={styles.saida} action="/sair" method="post">
          <Button type="submit" variant="ghost" title="Sair"><Icone nome="sair" /><span className={styles.rotuloMenu}>Sair</span></Button>
        </form>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <Button className={styles.menu} variant="ghost" size="icon" aria-label="Menu do CRM" aria-controls="menu-fila" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>☰</Button>
          <Suspense fallback={<span className={styles.titulo}>{TITULO[area]}</span>}><CaminhoCrm area={area} titulo={TITULO[area]} /></Suspense>
          <div className={styles.controles}>
            <label className={styles.tema}><span>Tema</span><NativeSelect aria-label={TEMA[area]} value={tema} onChange={e => setTema(e.target.value as TemaCrm)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></NativeSelect></label>
            <div className={styles.perfil}>
              <span className={styles.avatar} aria-hidden="true">{nome.trim().slice(0, 1).toUpperCase()}</span>
              <div className={styles.identidade}><span className={styles.nome} title={nome}>{nome}</span><small>{papel === 'gestor' ? 'Gestor' : 'Vendedor'}</small></div>
            </div>
          </div>
        </header>
        <div id="conteudo-fila" tabIndex={-1} className={styles.conteudo}>{children}</div>
      </div>
    </div>
  </TemaCrmContext.Provider>
}
