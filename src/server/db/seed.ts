import { comAdmin } from './admin'

type Resultado = { ok: true; id: string } | { ok: false; motivo: 'ja_existe_gestor_ativo' | 'email_invalido' }

// Roda como admin, sem identidade: criado_por fica nulo de propósito.
// Nunca pelo pool.ts: a guarda de papel derrubaria o processo.
export async function criarPrimeiroGestor(urlAdmin: string, dados: { nome: string; email: string }): Promise<Resultado> {
  const email = dados.email.trim().toLowerCase()
  if (!email.includes('@')) return { ok: false, motivo: 'email_invalido' }
  return comAdmin(urlAdmin, async (c) => {
    const existe = await c.query("SELECT 1 FROM usuario WHERE papel = 'gestor' AND ativo LIMIT 1")
    if (existe.rowCount) return { ok: false, motivo: 'ja_existe_gestor_ativo' }
    const { rows } = await c.query<{ id: string }>(
      "INSERT INTO usuario (nome, email, papel) VALUES ($1, $2, 'gestor') RETURNING id",
      [dados.nome.trim(), email],
    )
    return { ok: true, id: rows[0].id }
  })
}
