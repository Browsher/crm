'use server'

import type { ReactNode } from 'react'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { ConteudoBusca } from './conteudo'
import { lerDetalhesEmpresa } from '@/src/server/empresas/detalhes'
import { lerResumosBusca } from '@/src/server/atendimento/consulta'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import { EmpresaDetalhes } from '@/src/components/crm/empresa-detalhes'

// Leitura da busca persistida. Não reserva limite nem chama o fornecedor.
export async function lerDetalheBuscaAcao(id: string): Promise<{ ok: true; conteudo: ReactNode } | { ok: false; erro: string }> {
  const eu = await exigir('usuario')
  const repo = repositorioBusca(eu.usuarioId)
  try {
    const busca = await repo.ler(id)
    if (!busca) return { ok: false, erro: 'Esta busca não está disponível para você. Feche e confira o histórico.' }
    const gestor = eu.papel === 'gestor'
    const limite = gestor ? null : await repo.meuLimite()
    const resumos = gestor ? null : await lerResumosBusca(eu.usuarioId, busca.id)
    return { ok: true, conteudo: <ConteudoBusca busca={busca} gestor={gestor} bloqueada={Boolean(limite?.pausado)} resumos={resumos?.ok ? resumos.empresas : []} /> }
  } catch {
    return { ok: false, erro: 'Não foi possível carregar a busca. Tente novamente.' }
  }
}

export async function lerEmpresaBuscaAcao(id: string, cnpj: string): Promise<{ ok: true; conteudo: ReactNode } | { ok: false; erro: string }> {
  const eu = await exigir('usuario')
  try {
    const r = await lerDetalhesEmpresa(eu.usuarioId, { tipo: 'busca', buscaId: id, cnpj })
    if (!r.ok) return { ok: false, erro: 'Esta empresa não está disponível para você.' }
    return { ok: true, conteudo: <EmpresaDetalhes empresa={r.dados} /> }
  } catch {
    return { ok: false, erro: 'Não foi possível carregar a empresa. Tente novamente.' }
  }
}

export async function lerDetalhesEmpresaAcao(referencia: ReferenciaEmpresa) {
  const eu = await exigir('usuario')
  return lerDetalhesEmpresa(eu.usuarioId, referencia)
}
