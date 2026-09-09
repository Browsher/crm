'use server'

import { revalidatePath } from 'next/cache'
import { mensagemDeUsuario } from '@/src/features/usuarios/mensagens'
import type { Acao } from '@/src/features/usuarios/regras'
import { repositorioPostgres, type RepositorioUsuarios } from '@/src/features/usuarios/repositorio'
import {
  criarUsuario,
  desativar,
  mudarPapel,
  novaSenhaProvisoria,
  reativar,
  type ResultadoSimples,
} from '@/src/features/usuarios/servico'
import { exigir } from '@/src/server/autenticacao/guarda'

export type EstadoCriar = { erro: string | null; criado: { nome: string; senhaProvisoria: string } | null }
export type EstadoLinha = { erro: string | null; senhaProvisoria: string | null }

const CRIAR_INICIAL: EstadoCriar = { erro: null, criado: null }

export async function criarUsuarioAcao(_anterior: EstadoCriar, form: FormData): Promise<EstadoCriar> {
  const eu = await exigir('gestor')
  // "Criar outro" volta ao formulário vazio: uma ida ao servidor, zero lógica no cliente.
  if (form.get('limpar')) return CRIAR_INICIAL
  const nome = String(form.get('nome') ?? '')
  const r = await criarUsuario(repositorioPostgres(eu.usuarioId), {
    nome,
    email: String(form.get('email') ?? ''),
    papel: String(form.get('papel') ?? ''),
  })
  if (!r.ok) return { erro: mensagemDeUsuario(r), criado: null }
  revalidatePath('/usuarios')
  return { erro: null, criado: { nome: nome.trim(), senhaProvisoria: r.senhaProvisoria } }
}

const ACOES: readonly string[] = ['nova_senha', 'mudar_papel', 'desativar', 'reativar']

// Uma action para os quatro botões da linha: o campo `acao` diz qual.
export async function agirNaLinhaAcao(_anterior: EstadoLinha, form: FormData): Promise<EstadoLinha> {
  const eu = await exigir('gestor')
  const id = String(form.get('id') ?? '')
  const acao = String(form.get('acao') ?? '')
  if (!ACOES.includes(acao)) return { erro: 'Ação desconhecida.', senhaProvisoria: null }
  const repo = repositorioPostgres(eu.usuarioId)

  // `nova_senha` sai à parte por ser a única que devolve senha. Perguntar
  // `'senhaProvisoria' in r` no resultado unido daria `unknown`: o membro sem
  // o campo ganha a propriedade como desconhecida em vez de sumir da união.
  if (acao === 'nova_senha') {
    const r = await novaSenhaProvisoria(repo, id)
    if (!r.ok) return { erro: mensagemDeUsuario(r), senhaProvisoria: null }
    revalidatePath('/usuarios')
    return { erro: null, senhaProvisoria: r.senhaProvisoria }
  }

  const r = await executar(acao as Exclude<Acao, 'nova_senha'>, repo, id, form)
  if (!r.ok) return { erro: mensagemDeUsuario(r), senhaProvisoria: null }
  revalidatePath('/usuarios')
  return { erro: null, senhaProvisoria: null }
}

function executar(
  acao: Exclude<Acao, 'nova_senha'>,
  repo: RepositorioUsuarios,
  id: string,
  form: FormData,
): Promise<ResultadoSimples> {
  if (acao === 'desativar') return desativar(repo, id)
  if (acao === 'reativar') return reativar(repo, id)
  const papel = String(form.get('papel') ?? '')
  return mudarPapel(repo, id, papel === 'gestor' ? 'gestor' : 'vendedor')
}
