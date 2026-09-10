// Forma das linhas que as funções de `autenticacao` devolvem. Uma fonte só,
// para `entrar`, `trocarSenha` e `sessao` não repetirem o tipo.
export type Papel = 'vendedor' | 'gestor'

export type LinhaCredencial = {
  usuario_id: string
  senha_hash: string
  versao: string
  ativo: boolean
  senha_provisoria_pendente: boolean
}

export type LinhaBloqueio = { bloqueado: boolean; segundos_restantes: number }

export type LinhaSessao = {
  usuario_id: string
  nome: string
  email: string
  papel: Papel
  senha_provisoria_pendente: boolean
  expira_em: Date
}

export type LinhaSenhaTrocar = { senha_trocar: string | null }

export type LinhaSessaoCriada = { senha_provisoria_pendente: boolean }
