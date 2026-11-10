'use client'
import { useState } from 'react'
import { CardEmpresa } from '@/src/components/crm/card-empresa'
import { EmpresaDialogo } from '@/src/components/crm/empresa-dialogo'
import { Button } from '@/src/components/ui/button'
import { EstadoVazio, type AcaoEstadoVazio } from '@/src/components/crm/estado-vazio'
import { enderecoEmpresas, type ConsultaEmpresas } from '@/src/features/empresas/consulta'
import type { ResumoEmpresaGestor, ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import { LinkFichaEmpresa } from './[id]/link-ficha'
import styles from './empresas.module.css'

export function Lista({ linhas, consulta, retorno, vazio }: {
  linhas: ResumoEmpresaGestor[]
  consulta?: ConsultaEmpresas
  retorno?: string
  vazio?: { descricao: string; acao?: AcaoEstadoVazio }
}) {
  const [selecionada, setSelecionada] = useState<{ referencia: ReferenciaEmpresa; gatilho: HTMLButtonElement } | null>(null)
  const query = retorno ? new URLSearchParams({ retorno }).toString() : consulta ? enderecoEmpresas(consulta).split('?')[1] : undefined
  if (linhas.length === 0) return <EstadoVazio titulo="Nenhuma empresa encontrada"
    descricao={vazio?.descricao ?? 'Tente outro nome ou CNPJ, ou consulte a lista completa.'}
    acao={vazio ? vazio.acao : { rotulo: 'Ver todas', href: '/empresas', variante: 'outline' }} />

  return <section aria-label="Empresas cadastradas">
    <ul className={styles.cartoes}>{linhas.map(empresa => <li key={empresa.id}>
      <CardEmpresa empresa={empresa} responsavel={empresa.responsavel} aoVer={(referencia, gatilho) => setSelecionada({ referencia, gatilho })} rotuloVer="Consulta rápida"
        acoesAdicionais={<Button asChild variant="ghost"><LinkFichaEmpresa href={`/empresas/${empresa.id}${query ? `?${query}` : ''}`}>Ficha completa</LinkFichaEmpresa></Button>} />
    </li>)}</ul>
    {selecionada && <EmpresaDialogo referencia={selecionada.referencia} origem={selecionada.gatilho} aoFechar={() => setSelecionada(null)} />}
  </section>
}
