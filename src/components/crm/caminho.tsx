'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './shell.module.css'

const subpaginas: { rota: RegExp; niveis: { nome: string; href?: string }[] }[] = [
  { rota: /^\/whatsapp\/configuracao$/, niveis: [{ nome: 'Configurar vendedores' }] },
  { rota: /^\/empresas\/importar$/, niveis: [{ nome: 'Importar empresas' }] },
  { rota: /^\/empresas\/grupos$/, niveis: [{ nome: 'Grupos' }] },
  { rota: /^\/empresas\/grupos\/[^/]+$/, niveis: [{ nome: 'Grupos', href: '/empresas/grupos' }, { nome: 'Detalhes do grupo' }] },
  { rota: /^\/empresas\/[^/]+$/, niveis: [{ nome: 'Ficha da empresa' }] },
  { rota: /^\/usuarios\/vendedores\/[^/]+$/, niveis: [{ nome: 'Perfil do vendedor' }] },
  { rota: /^\/carteira\/[^/]+$/, niveis: [{ nome: 'Ficha da empresa' }] },
  { rota: /^\/fila\/localizar$/, niveis: [{ nome: 'Localizar empresa' }] },
  { rota: /^\/fila\/localizar\/[^/]+$/, niveis: [{ nome: 'Localizar empresa', href: '/fila/localizar' }, { nome: 'Perfil da empresa' }] },
]

export function CaminhoCrm({ area, titulo }: { area: string; titulo: string }) {
  const pathname = usePathname()
  const rota = pathname?.replace(/\/$/, '') ?? `/${area}`
  const extras = rota.startsWith(`/${area}/`) ? subpaginas.find(item => item.rota.test(rota))?.niveis ?? [] : []
  const niveis = [{ nome: 'CRM', href: '/' }, { nome: titulo, href: extras.length ? `/${area}` : undefined }, ...extras]
  return <nav className={styles.caminho} aria-label="Localização atual"><ol>
    {niveis.map((nivel, i) => <li key={`${i}-${nivel.nome}`}>
      {i > 0 && <span className={styles.separador} aria-hidden="true">/</span>}
      {nivel.href ? <Link href={nivel.href}>{nivel.nome}</Link> : <span className={styles.titulo} aria-current="page">{nivel.nome}</span>}
    </li>)}
  </ol></nav>
}
