'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { lerRetornoGestor, urlRetornoGestor } from '@/src/lib/retorno-gestor'
import { CAMPOS_PESSOAIS, lerFiltrosPessoais, urlPessoal } from '@/src/lib/prospeccao-pessoal'
import { lerRecorteUsuarios, urlUsuarios } from '@/src/lib/recorte-usuarios'
import styles from './shell.module.css'

type Nivel = { nome: string; href?: string }
const detalheGrupo = /^\/empresas\/grupos\/[^/]+$/
const fichaEmpresa = /^\/empresas\/[^/]+$/
const nivelFicha = { nome: 'Ficha da empresa' }
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
  { rota: fichaEmpresa, niveis: [nivelFicha] },
  { rota: /^\/usuarios\/vendedores\/[^/]+$/, niveis: [{ nome: 'Perfil do vendedor' }] },
  { rota: /^\/carteira\/[^/]+$/, niveis: [{ nome: 'Ficha da empresa' }] },
  { rota: /^\/fila\/localizar\/[^/]+$/, niveis: [{ nome: 'Localizar empresa', href: '/fila/localizar' }, { nome: 'Perfil da empresa' }] },
]

export function CaminhoCrm({ area, titulo }: { area: string; titulo: string }) {
  const pathname = usePathname()
  const rota = pathname?.replace(/\/$/, '') ?? `/${area}`
  const subpagina = rota.startsWith(`/${area}/`) ? subpaginas.find(item => item.rota.test(rota)) : undefined
  if (area === 'fila' && (rota === '/fila/localizar' || rota === '/fila/sem-interesse' || /^\/fila\/atendimento\/[^/]+$/.test(rota))) {
    return <CaminhoProspeccao rota={rota} titulo={titulo} />
  }
  const extras = subpagina?.niveis ?? []
  const niveis = [{ nome: 'CRM', href: '/' }, { nome: titulo, href: extras.length ? `/${area}` : undefined }, ...extras]
  if (subpagina?.rota === detalheGrupo || subpagina?.rota === fichaEmpresa) {
    return <CaminhoArquivo niveis={niveis} ficha={subpagina.rota === fichaEmpresa} />
  }
  if (area === 'usuarios' && extras.length) return <CaminhoPerfil niveis={niveis} />
  return <Trilha niveis={niveis} />
}

function CaminhoPerfil({ niveis }: { niveis: Nivel[] }) {
  const query = new URLSearchParams(useSearchParams())
  return <Trilha niveis={[niveis[0], { ...niveis[1], href: urlUsuarios(lerRecorteUsuarios(query, true)) }, ...niveis.slice(2)]} />
}

function CaminhoProspeccao({ rota, titulo }: { rota: string; titulo: string }) {
  const query = useSearchParams()
  const consulta = Object.fromEntries(CAMPOS_PESSOAIS.flatMap(campo => {
    const valores = query.getAll(campo)
    return valores.length ? [[campo, valores.length === 1 ? valores[0] : valores]] : []
  }))
  const lidos = lerFiltrosPessoais(consulta)
  const filtros = lidos.ok ? lidos.filtros : {}
  const semInteresse = rota === '/fila/sem-interesse' || filtros.disponibilidade === 'sem_interesse'
  const atendimento = rota.startsWith('/fila/atendimento/')
  const niveis: Nivel[] = [{ nome: 'CRM', href: '/' }, { nome: titulo, href: '/fila' }]
  if (semInteresse) niveis.push({ nome: 'Localizar empresas', href: '/fila/localizar' })
  niveis.push({
    nome: semInteresse ? 'Sem interesse' : 'Localizar empresas',
    href: atendimento ? urlPessoal(filtros, Number(filtros.pagina || 1), true) : undefined,
  })
  if (atendimento) niveis.push({ nome: 'Atendimento' })
  return <Trilha niveis={niveis} />
}

function CaminhoArquivo({ niveis, ficha }: { niveis: Nivel[]; ficha: boolean }) {
  const valores = useSearchParams().getAll('retorno')
  const retorno = lerRetornoGestor(valores.length === 1 ? valores[0] : valores)
  const grupo = ficha && retorno?.tipo === 'grupo' ? retorno : undefined
  const arquivo = retorno?.tipo === 'arquivo' ? retorno : grupo?.arquivo
  if (!arquivo) return <Trilha niveis={niveis} />

  const niveisArquivo: Nivel[] = [niveis[0], { nome: 'Arquivo', href: urlRetornoGestor(arquivo) }]
  if (grupo || !ficha) niveisArquivo.push({ nome: 'Lista arquivada', href: grupo ? urlRetornoGestor(grupo) : undefined })
  if (ficha) niveisArquivo.push(nivelFicha)
  return <Trilha niveis={niveisArquivo} />
}

function Trilha({ niveis }: { niveis: Nivel[] }) {
  return <nav className={styles.caminho} aria-label="Localização atual"><ol>
    {niveis.map((nivel, i) => <li key={`${i}-${nivel.nome}`}>
      {i > 0 && <span className={styles.separador} aria-hidden="true">/</span>}
      {nivel.href ? <Link href={nivel.href}>{nivel.nome}</Link> : <span className={styles.titulo} aria-current="page">{nivel.nome}</span>}
    </li>)}
  </ol></nav>
}
