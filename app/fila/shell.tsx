'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { NativeSelect } from '@/src/components/ui/native-select'
import { TemaFilaContext, type TemaFila } from './tema'
import styles from './shell.module.css'

export function ShellFila({ children, nome, papel }: { children: ReactNode; nome: string; papel: 'gestor' | 'vendedor' }) {
  const [tema, setTema] = useState<TemaFila>('system')
  const [aberto, setAberto] = useState(false)
  return <TemaFilaContext.Provider value={tema}>
    <div className={`crm-ui ${styles.shell}`} data-theme={tema}>
      <a className={styles.skip} href="#conteudo-fila">Ir para o conteúdo</a>
      <aside className={`${styles.sidebar} ${aberto ? styles.aberto : ''}`} id="menu-fila">
        <Link href="/" className={styles.marca}><span aria-hidden="true">C</span><strong>CRM</strong></Link>
        <nav aria-label="Navegação do CRM" onClick={() => setAberto(false)}>
          <Link href="/fila" aria-current="page">Prospecção</Link>
          <Link href="/carteira">Carteira</Link>
          {papel === 'gestor' && <><Link href="/empresas">Empresas</Link><Link href="/usuarios">Usuários</Link></>}
          <Link href="/">Início</Link>
        </nav>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <Button className={styles.menu} variant="ghost" size="icon" aria-label="Menu do CRM" aria-controls="menu-fila" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>☰</Button>
          <span className={styles.titulo}>Prospecção</span>
          <div className={styles.controles}><span className={styles.nome}>{nome}</span><NativeSelect aria-label="Tema da Fila" value={tema} onChange={e => setTema(e.target.value as TemaFila)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></NativeSelect></div>
        </header>
        <div id="conteudo-fila" tabIndex={-1} className={styles.conteudo}>{children}</div>
      </div>
    </div>
  </TemaFilaContext.Provider>
}
