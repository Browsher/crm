'use server'

import type { ReactNode } from 'react'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { ConteudoBusca } from './conteudo'

// Leitura da busca persistida. Não reserva limite nem chama o fornecedor.
export async function lerDetalheBuscaAcao(id: string): Promise<{ ok: true; conteudo: ReactNode } | { ok: false; erro: string }> {
  const eu = await exigir('usuario')
  const repo = repositorioBusca(eu.usuarioId)
  try {
    const busca = await repo.ler(id)
    if (!busca) return { ok: false, erro: 'Esta busca não está disponível para você. Feche e confira o histórico.' }
    const gestor = eu.papel === 'gestor'
    const limite = gestor ? null : await repo.meuLimite()
    return { ok: true, conteudo: <ConteudoBusca busca={busca} gestor={gestor} bloqueada={Boolean(limite?.pausado)} /> }
  } catch {
    return { ok: false, erro: 'Não foi possível carregar a busca. Tente novamente.' }
  }
}

export async function lerEmpresaBuscaAcao(id: string, cnpj: string): Promise<{ ok: true; conteudo: ReactNode } | { ok: false; erro: string }> {
  const eu = await exigir('vendedor')
  if (typeof id !== 'string' || typeof cnpj !== 'string' || !/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return { ok: false, erro: 'Empresa inválida.' }
  const repo = repositorioBusca(eu.usuarioId)
  try {
    const busca = await repo.ler(id)
    if (!busca || busca.usuario_id !== eu.usuarioId) return { ok: false, erro: 'Esta busca não está disponível para você.' }
    const empresa = busca.empresas.find(e => e.cnpj === cnpj)
    if (!empresa) return { ok: false, erro: 'Esta empresa não faz parte desta busca.' }
    const limite = await repo.meuLimite()
    return { ok: true, conteudo: <ConteudoBusca busca={{ ...busca, empresas: [empresa] }} retornadas={busca.empresas.length} gestor={false} bloqueada={Boolean(limite?.pausado)} /> }
  } catch {
    return { ok: false, erro: 'Não foi possível carregar a empresa. Tente novamente.' }
  }
}
