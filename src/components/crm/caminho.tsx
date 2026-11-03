'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { lerRetornoGestor, urlRetornoGestor } from '@/src/lib/retorno-gestor'
import styles from './shell.module.css'

type Nivel = { nome: string; href?: string }
const detalheGrupo = /^\/empresas\/grupos\/[^/]+$/
const subpaginas: { rota: RegExp; niveis: Nivel[] }[] = [
  { rota: /^\/fila\/google$/, niveis: [{ nome: 'Busca no Google' }] },
  { rota: /^\/fila\/google\/[^/]+$/, niveis: [{ nome: 'Busca no Google', href: '/fila/google' }, { nome: 'Empresas recebidas' }] },
  { rota: /^\/empresas\/google$/, niveis: [{ nome: 'Coletas do Google' }] },
  { rota: /^\/empresas\/google\/[^/]+$/, niveis: [{ nome: 'Coletas do Google', href: '/empresas/google' }, { nome: 'Histórico da coleta' }] },
  { rota: /^\/fila\/buscar$/, niveis: [{ nome: 'Banco de empresas' }] },
  { rota: /^\/empresas\/busca$/, niveis: [{ nome: 'Busca de empresas' }] },
  { rota: /^\/whatsapp\/configuracao$/, niveis: [{ nome: 'Configurar vendedores' }] },
  { rota: /^\/empresas\/importar$/, niveis: [{ nome: 'Importar empresas' }] },
  { rota: /^\/empresas\/grupos$/, niveis: [{ nome: 'Listas' }] },
  { rota: detalheGrupo, niveis: [{ nome: 'Listas', href: '/empresas/grupos' }, { nome: 'Detalhes da lista' }] },
  { rota: /^\/empresas\/arquivadas$/, niveis: [{ nome: 'Arquivo' }] },
  { rota: /^\/empresas\/[^/]+$/, niveis: [{ nome: 'Ficha da empresa' }] },
  { rota: /^\/usuarios\/vendedores\/[^/]+$/, niveis: [{ nome: 'Perfil do vendedor' }] },
  { rota: /^\/carteira\/[^/]+$/, niveis: [{ nome: 'Ficha da empresa' }] },
  { rota: /^\/fila\/localizar$/, niveis: [{ nome: 'Localizar empresas' }] },
  { rota: /^\/fila\/localizar\/[^/]+$/, niveis: [{ nome: 'Localizar empresa', href: '/fila/localizar' }, { nome: 'Perfil da empresa' }] },
]

export function CaminhoCrm({ area, titulo }: { area: string; titulo: string }) {
  const pathname = usePathname()
  const rota = pathname?.replace(/\/$/, '') ?? `/${area}`
  const extras = rota.startsWith(`/${area}/`) ? subpaginas.find(item => item.rota.test(rota))?.niveis ?? [] : []
  const niveis = [{ nome: 'CRM', href: '/' }, { nome: titulo, href: extras.length ? `/${area}` : undefined }, ...extras]
  if (area === 'empresas' && detalheGrupo.test(rota)) return <CaminhoDetalheGrupo niveis={niveis} />
  return <Trilha niveis={niveis} />
}

function CaminhoDetalheGrupo({ niveis }: { niveis: Nivel[] }) {
  const valores = useSearchParams().getAll('retorno')
  const retorno = lerRetornoGestor(valores.length === 1 ? valores[0] : valores)
  if (retorno?.tipo !== 'arquivo') return <Trilha niveis={niveis} />
  return <Trilha niveis={[niveis[0], { nome: 'Arquivo', href: urlRetornoGestor(retorno) }, { nome: 'Lista arquivada' }]} />
}

function Trilha({ niveis }: { niveis: Nivel[] }) {
  return <nav className={styles.caminho} aria-label="Localização atual"><ol>
    {niveis.map((nivel, i) => <li key={`${i}-${nivel.nome}`}>
      {i > 0 && <span className={styles.separador} aria-hidden="true">/</span>}
      {nivel.href ? <Link href={nivel.href}>{nivel.nome}</Link> : <span className={styles.titulo} aria-current="page">{nivel.nome}</span>}
    </li>)}
  </ol></nav>
}
