import type { Sessao } from './sessao'

export type Exigencia = 'sessao' | 'usuario' | 'gestor' | 'vendedor'
export type Acesso =
  | { ok: true; usuario: Sessao }
  | { ok: false; motivo: 'sem_sessao' | 'senha_provisoria' | 'so_gestor' | 'so_vendedor'; destino: string }

// Pura: quem redireciona é guarda.ts. `sessao` aceita pendente, para a
// própria tela de troca; `usuario` e `gestor` não.
export function avaliarAcesso(sessao: Sessao | null, exigencia: Exigencia): Acesso {
  if (!sessao) return { ok: false, motivo: 'sem_sessao', destino: '/login' }
  if (exigencia === 'sessao') return { ok: true, usuario: sessao }
  if (sessao.senhaProvisoriaPendente) return { ok: false, motivo: 'senha_provisoria', destino: '/trocar-senha' }
  if (exigencia === 'gestor' && sessao.papel !== 'gestor') return { ok: false, motivo: 'so_gestor', destino: '/' }
  if (exigencia === 'vendedor' && sessao.papel !== 'vendedor') return { ok: false, motivo: 'so_vendedor', destino: '/gestao' }
  return { ok: true, usuario: sessao }
}
