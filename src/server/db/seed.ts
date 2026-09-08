import { gerarHash, gerarSenhaProvisoria } from '../autenticacao/senha'
import { comAdmin } from './admin'

type Resultado =
  | { ok: true; id: string; senhaProvisoria: string }
  | { ok: false; motivo: 'ja_existe_gestor_ativo' | 'email_invalido' }

// Roda como admin, sem identidade: criado_por fica nulo de propósito.
// Nunca pelo pool.ts: a guarda de papel derrubaria o processo.
// Grava a credencial direto na tabela: credencial_definir só entra na fatia
// de usuários, com eh_gestor() por dentro.
export async function criarPrimeiroGestor(urlAdmin: string, dados: { nome: string; email: string }): Promise<Resultado> {
  const email = dados.email.trim().toLowerCase()
  if (!email.includes('@')) return { ok: false, motivo: 'email_invalido' }
  const senhaProvisoria = gerarSenhaProvisoria()
  const hash = await gerarHash(senhaProvisoria)
  return comAdmin(urlAdmin, async (c) => {
    const existe = await c.query("SELECT 1 FROM usuario WHERE papel = 'gestor' AND ativo LIMIT 1")
    if (existe.rowCount) return { ok: false, motivo: 'ja_existe_gestor_ativo' }
    await c.query('BEGIN')
    try {
      const { rows } = await c.query<{ id: string }>(
        "INSERT INTO usuario (nome, email, papel, senha_provisoria_pendente) VALUES ($1, $2, 'gestor', true) RETURNING id",
        [dados.nome.trim(), email],
      )
      await c.query('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [rows[0].id, hash])
      await c.query('COMMIT')
      return { ok: true, id: rows[0].id, senhaProvisoria }
    } catch (erro) {
      await c.query('ROLLBACK')
      throw erro
    }
  })
}
