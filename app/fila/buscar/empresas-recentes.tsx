'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { EmpresaBancoRecente } from '@/src/lib/empresas-banco-recentes'
import { detalhesSnapshot, type ResumoEmpresa } from '@/src/lib/empresa-visual'
import { Cartao } from '../cartao'
import { Button } from '@/src/components/ui/button'
export function EmpresasBancoRecentes({ empresas, resumos = [] }: { empresas: EmpresaBancoRecente[]; resumos?: ResumoEmpresa[] }) {
  const [pagina, setPagina] = useState(0)
  const recentes = empresas.slice(0, 11)
  const paginas = Math.max(1, Math.ceil(recentes.length / 3))
  const atual = Math.min(pagina, paginas - 1)
  return <section aria-label="Últimas buscas"><header className="flex flex-wrap items-center justify-between gap-4"><div><h2>Últimas buscas</h2><p>Empresas encontradas nas suas pesquisas mais recentes.</p></div><nav aria-label="Navegação das empresas recentes"><Button variant="outline" disabled={atual === 0} onClick={() => setPagina(atual - 1)}>Empresas anteriores</Button><span role="status">Página {atual + 1} de {paginas}</span><Button variant="outline" disabled={atual + 1 === paginas} onClick={() => setPagina(atual + 1)}>Próximas empresas</Button></nav></header>
    {!recentes.length && <p>As empresas encontradas nas suas buscas aparecerão aqui.</p>}
    <ul className="grid gap-4 md:grid-cols-3">{recentes.slice(atual * 3, atual * 3 + 3).map(e => <li key={e.id}><Cartao empresa={resumos.find(r => r.id === e.empresaId) ?? detalhesSnapshot({ cnpj: e.cnpj, nome_fantasia: e.nome, cnae_principal: e.cnae, bairro: e.bairro, cidade: e.cidade, uf: e.uf }, { tipo: 'busca', buscaId: e.buscaId, cnpj: e.cnpj }, e.entrada)} filtros={{ origem: 'banco' }} /><Button asChild variant="ghost"><Link href={'/fila/buscar?busca=' + encodeURIComponent(e.buscaId)}>Ver busca</Link></Button></li>)}</ul>
    <Button asChild variant="outline"><Link href="/fila/localizar?origem=banco">Ver todas as empresas</Link></Button>
  </section>
}