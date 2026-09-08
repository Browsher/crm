import { chamar } from '../db/sem-identidade'
import type { LinhaCredencial, LinhaSenhaTrocar } from './linhas'
import { gerarHash, validarSenha, verificarSenha, type Falta } from './senha'
import { hashDoToken, lerSessao } from './sessao'

export type ResultadoTrocar =
  | { ok: true }
  | { ok: false; motivo: 'senha_fraca'; faltas: Falta[] }
  | { ok: false; motivo: 'senha_atual_invalida' }
  | { ok: false; motivo: 'sem_sessao' }

// A senha atual é exigida para uma sessão roubada não virar troca de senha.
// O banco deriva o usuário da sessão: só troca a senha de quem a tem em mãos.
export async function trocarSenha(dados: { token: string; senhaAtual: string; senhaNova: string }): Promise<ResultadoTrocar> {
  const validacao = validarSenha(dados.senhaNova, dados.senhaAtual)
  if (!validacao.ok) return { ok: false, motivo: 'senha_fraca', faltas: validacao.faltas }

  const sessao = await lerSessao(dados.token)
  if (!sessao) return { ok: false, motivo: 'sem_sessao' }

  const [credencial] = await chamar<'credencial_por_email', LinhaCredencial>('credencial_por_email', [sessao.email])
  if (!credencial || !(await verificarSenha(dados.senhaAtual, credencial.senha_hash))) {
    return { ok: false, motivo: 'senha_atual_invalida' }
  }

  const [r] = await chamar<'senha_trocar', LinhaSenhaTrocar>('senha_trocar', [hashDoToken(dados.token), await gerarHash(dados.senhaNova)])
  if (!r.senha_trocar) return { ok: false, motivo: 'sem_sessao' }
  return { ok: true }
}
