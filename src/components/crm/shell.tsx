'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { NativeSelect } from '@/src/components/ui/native-select'
import { TemaCrmContext, type TemaCrm } from './tema'
import styles from './shell.module.css'

const TITULO = { funil: 'Funil', fila: 'Prospecção', carteira: 'Carteira', 'meu-dia': 'Meu dia', empresas: 'Empresas', usuarios: 'Usuários', gestao: 'Gestão', whatsapp: 'WhatsApp' } as const
const TEMA = { funil: 'Tema do Funil', fila: 'Tema da Fila', carteira: 'Tema da Carteira', 'meu-dia': 'Tema do Meu dia', empresas: 'Tema de Empresas', usuarios: 'Tema de Usuários', gestao: 'Tema da Gestão', whatsapp: 'Tema do WhatsApp' } as const

export function ShellCrm({ children, nome, papel, area }: { children: ReactNode; nome: string; papel: 'gestor' | 'vendedor'; area: keyof typeof TITULO }) {
  const [tema, setTema] = useState<TemaCrm>('system')
  const [aberto, setAberto] = useState(false)
  return <TemaCrmContext.Provider value={tema}>
    <div className={`crm-ui ${styles.shell}`} data-theme={tema}>
      <a className={styles.skip} href="#conteudo-fila">Ir para o conteúdo</a>
      <aside className={`${styles.sidebar} ${aberto ? styles.aberto : ''}`} id="menu-fila">
        <Link href="/" className={styles.marca}><span aria-hidden="true">C</span><strong>CRM</strong></Link>
        <nav aria-label="Navegação do CRM" onClick={() => setAberto(false)}>
          {papel === 'vendedor' && <><Link href="/meu-dia" aria-current={area === 'meu-dia' ? 'page' : undefined}>Meu dia</Link>
          <Link href="/fila" aria-current={area === 'fila' ? 'page' : undefined}>Prospecção</Link>
          <Link href="/funil" aria-current={area === 'funil' ? 'page' : undefined}>Funil</Link>
          <Link href="/carteira" aria-current={area === 'carteira' ? 'page' : undefined}>Carteira</Link></>}
          {papel === 'gestor' && <><Link href="/gestao" aria-current={area === 'gestao' ? 'page' : undefined}>Início</Link><Link href="/empresas" aria-current={area === 'empresas' ? 'page' : undefined}>Empresas</Link><Link href="/empresas/grupos">Grupos</Link><Link href="/usuarios" aria-current={area === 'usuarios' ? 'page' : undefined}>Usuários</Link><Link href="/whatsapp" aria-current={area === 'whatsapp' ? 'page' : undefined}>WhatsApp</Link></>}
          <form action="/sair" method="post">
            <Button type="submit" variant="ghost">Sair</Button>
          </form>
        </nav>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <Button className={styles.menu} variant="ghost" size="icon" aria-label="Menu do CRM" aria-controls="menu-fila" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>☰</Button>
          <nav className={styles.caminho} aria-label="Localização atual">
            <Link href="/">CRM</Link><span aria-hidden="true">/</span><span className={styles.titulo} aria-current="page">{TITULO[area]}</span>
          </nav>
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
