'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { NativeSelect } from '@/src/components/ui/native-select'
import { TemaCrmContext, type TemaCrm } from './tema'
import styles from './shell.module.css'

const TITULO = { fila: 'Prospecção', carteira: 'Carteira', 'meu-dia': 'Meu dia' } as const
const TEMA = { fila: 'Tema da Fila', carteira: 'Tema da Carteira', 'meu-dia': 'Tema do Meu dia' } as const

export function ShellCrm({ children, nome, papel, area }: { children: ReactNode; nome: string; papel: 'gestor' | 'vendedor'; area: 'fila' | 'carteira' | 'meu-dia' }) {
  const [tema, setTema] = useState<TemaCrm>('system')
  const [aberto, setAberto] = useState(false)
  return <TemaCrmContext.Provider value={tema}>
    <div className={`crm-ui ${styles.shell}`} data-theme={tema}>
      <a className={styles.skip} href="#conteudo-fila">Ir para o conteúdo</a>
      <aside className={`${styles.sidebar} ${aberto ? styles.aberto : ''}`} id="menu-fila">
        <Link href="/" className={styles.marca}><span aria-hidden="true">C</span><strong>CRM</strong></Link>
        <nav aria-label="Navegação do CRM" onClick={() => setAberto(false)}>
          <Link href="/fila" aria-current={area === 'fila' ? 'page' : undefined}>Prospecção</Link>
          <Link href="/meu-dia" aria-current={area === 'meu-dia' ? 'page' : undefined}>Meu dia</Link>
          <Link href="/carteira" aria-current={area === 'carteira' ? 'page' : undefined}>Carteira</Link>
          {papel === 'gestor' && <><Link href="/empresas">Empresas</Link><Link href="/usuarios">Usuários</Link></>}
          <form action="/sair" method="post">
            <Button type="submit" variant="ghost">Sair</Button>
          </form>
        </nav>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <Button className={styles.menu} variant="ghost" size="icon" aria-label="Menu do CRM" aria-controls="menu-fila" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>☰</Button>
          <span className={styles.titulo}>{TITULO[area]}</span>
          <div className={styles.controles}><span className={styles.nome}>{nome}</span><NativeSelect aria-label={TEMA[area]} value={tema} onChange={e => setTema(e.target.value as TemaCrm)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></NativeSelect></div>
        </header>
        <div id="conteudo-fila" tabIndex={-1} className={styles.conteudo}>{children}</div>
      </div>
    </div>
  </TemaCrmContext.Provider>
}
