import type { Papel } from '../../server/autenticacao/linhas'

export type Usuario = {
  id: string
  nome: string
  email: string
  papel: Papel
  ativo: boolean
  senhaProvisoriaPendente: boolean
}

export type Acao = 'nova_senha' | 'mudar_papel' | 'desativar' | 'reativar'

// Puras. A tela só passa dados; quem decide o que cada linha oferece é aqui.
export function acoesDe(linha: Usuario, euId: string): Acao[] {
  if (linha.id === euId) return []
  if (!linha.ativo) return ['reativar']
  return ['nova_senha', 'mudar_papel', 'desativar']
}

export function gestorUnico(lista: Usuario[]): boolean {
  return lista.filter((u) => u.papel === 'gestor' && u.ativo).length === 1
}

export type FaltaNovoUsuario = 'nome_vazio' | 'email_invalido' | 'papel_invalido'
export type NovoUsuario = { nome: string; email: string; papel: Papel }

const PAPEIS: readonly string[] = ['vendedor', 'gestor']

export function validarNovoUsuario(dados: { nome: string; email: string; papel: string }):
  | { ok: true; dados: NovoUsuario }
  | { ok: false; faltas: FaltaNovoUsuario[] } {
  const nome = dados.nome.trim()
  const email = dados.email.trim().toLowerCase()
  const faltas: FaltaNovoUsuario[] = []
  if (nome === '') faltas.push('nome_vazio')
  if (!email.includes('@')) faltas.push('email_invalido')
  if (!PAPEIS.includes(dados.papel)) faltas.push('papel_invalido')
  if (faltas.length) return { ok: false, faltas }
  return { ok: true, dados: { nome, email, papel: dados.papel as Papel } }
}
