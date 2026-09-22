import { comoUsuario } from '../db/como-usuario'
import type { CadastroWhatsApp } from '@/src/lib/whatsapp-empresa'

export async function consultarEmpresas(usuarioId: string, telefones: string[]): Promise<Record<string, CadastroWhatsApp>> {
  const validos = [...new Set(telefones.filter(t => /^\+55\d{10,11}$/.test(t)))]
  if (!validos.length) return {}
  const resultado: Record<string, CadastroWhatsApp> = {}
  // Lotes limitados mesmo quando Todos reúne muitas instâncias.
  for (let inicio = 0; inicio < validos.length; inicio += 200) {
    const lote = validos.slice(inicio, inicio + 200)
    const r = await comoUsuario(usuarioId, e => e<{ telefone: string; quantidade: number; id: string; nome: string }>(`
      SELECT telefone, count(*)::int AS quantidade, min(id::text) AS id,
        min(coalesce(nome_fantasia, razao_social)) AS nome
      FROM empresa WHERE eh_gestor() AND telefone = ANY($1::text[]) GROUP BY telefone
    `, [lote.map(t => t.slice(3))]))
    const porTelefone = new Map(r.linhas.map(l => [l.telefone, l]))
    for (const telefone of lote) {
      const linha = porTelefone.get(telefone.slice(3))
      resultado[telefone] = !linha ? { telefone, estado: 'ausente' }
        : linha.quantidade !== 1 ? { telefone, estado: 'ambigua' }
          : { telefone, estado: 'encontrada', empresa: { id: linha.id, nome: linha.nome } }
    }
  }
  return resultado
}
