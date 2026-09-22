import { comoUsuario, type Executar } from '../db/como-usuario'

export type VinculoWhatsApp = {
  id: string
  vendedorId: string
  nome: string
  instancia: string
  ativo: boolean
}

export type ResultadoVinculo = { ok: true } | {
  ok: false
  motivo: 'sem_permissao' | 'nao_encontrado' | 'instancia_em_uso' | 'instancia_invalida' | 'vendedor_invalido'
}

export async function listarVinculos(usuarioId: string): Promise<VinculoWhatsApp[]> {
  const r = await comoUsuario(usuarioId, e => e<VinculoWhatsApp>(`
    SELECT v.id, v.vendedor_id AS "vendedorId", u.nome, v.instancia,
      (u.ativo AND u.papel = 'vendedor') AS ativo
    FROM whatsapp_vinculo v JOIN usuario u ON u.id = v.vendedor_id
    ORDER BY u.nome, v.id
  `))
  return r.linhas
}

export async function listarVendedores(usuarioId: string): Promise<{ id: string; nome: string }[]> {
  const r = await comoUsuario(usuarioId, e => e<{ id: string; nome: string }>(`
    SELECT id, nome FROM usuario WHERE eh_gestor() AND ativo AND papel = 'vendedor' ORDER BY nome, id
  `))
  return r.linhas
}

async function escrever(usuarioId: string, trabalho: (e: Executar) => Promise<ResultadoVinculo>): Promise<ResultadoVinculo> {
  try {
    return await comoUsuario(usuarioId, async e => {
      const r = await e<{ permitido: boolean }>('SELECT eh_gestor() AND pode_escrever() AS permitido')
      if (!r.linhas[0].permitido) return { ok: false, motivo: 'sem_permissao' }
      return trabalho(e)
    })
  } catch (erro) {
    const e = erro as { code?: string; constraint?: string }
    if (e?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
    if (e?.code === '23505' && e.constraint === 'whatsapp_vinculo_instancia_key') return { ok: false, motivo: 'instancia_em_uso' }
    if (e?.code === '23514' && e.constraint === 'whatsapp_vinculo_instancia_valida') return { ok: false, motivo: 'instancia_invalida' }
    if (e?.code === '23514' && e.constraint === 'whatsapp_vinculo_vendedor_valido') return { ok: false, motivo: 'vendedor_invalido' }
    throw erro
  }
}

export function salvarVinculo(usuarioId: string, vendedorId: string, instancia: string): Promise<ResultadoVinculo> {
  return escrever(usuarioId, async e => {
    await e(`INSERT INTO whatsapp_vinculo (vendedor_id, instancia) VALUES ($1, $2)
      ON CONFLICT (vendedor_id) DO UPDATE SET instancia = EXCLUDED.instancia`, [vendedorId, instancia])
    return { ok: true }
  })
}

export function removerVinculo(usuarioId: string, id: string): Promise<ResultadoVinculo> {
  return escrever(usuarioId, async e => {
    const r = await e('DELETE FROM whatsapp_vinculo WHERE id = $1', [id])
    if (!r.afetadas) return { ok: false, motivo: 'nao_encontrado' }
    return { ok: true }
  })
}
