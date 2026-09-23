import { comoUsuario } from '../db/como-usuario'
import type { CadastroWhatsApp, SituacaoEmpresaWhatsApp } from '@/src/lib/whatsapp-empresa'

export async function consultarEmpresas(usuarioId: string, telefones: string[]): Promise<Record<string, CadastroWhatsApp>> {
  const validos = [...new Set(telefones.filter(t => /^\+55\d{10,11}$/.test(t)))]
  if (!validos.length) return {}
  const resultado: Record<string, CadastroWhatsApp> = {}
  // Lotes limitados mesmo quando Todos reúne muitas instâncias.
  for (let inicio = 0; inicio < validos.length; inicio += 200) {
    const lote = validos.slice(inicio, inicio + 200)
    const r = await comoUsuario(usuarioId, e => e<{ telefone: string; quantidade: number; id: string; nome: string; situacao: SituacaoEmpresaWhatsApp }>(`
      WITH candidatas AS (SELECT telefone, count(*)::int AS quantidade, min(id::text) AS id,
        min(coalesce(nome_fantasia, razao_social)) AS nome
      FROM empresa WHERE eh_gestor() AND telefone = ANY($1::text[]) GROUP BY telefone)
      SELECT c.*,
        CASE WHEN dono.ativo THEN coalesce(n.etapa, 'carteira')
          WHEN f.reservado_ate > now() THEN 'reservada'
          WHEN NOT EXISTS (SELECT 1 FROM grupo_importacao_empresa ge
            JOIN grupo_importacao g ON g.id=ge.grupo_id AND g.ativo WHERE ge.empresa_id=c.id::uuid) THEN 'inativa'
          WHEN f.elegivel_em > now() THEN 'descanso' ELSE 'disponivel' END AS situacao
      FROM candidatas c
      LEFT JOIN empresa_fila f ON c.quantidade=1 AND f.empresa_id=c.id::uuid
      LEFT JOIN usuario dono ON dono.id=f.vendedor_id
      LEFT JOIN negociacao n ON n.empresa_id=f.empresa_id AND n.vendedor_id=f.vendedor_id AND n.encerrada_em IS NULL
    `, [lote.map(t => t.slice(3))]))
    const porTelefone = new Map(r.linhas.map(l => [l.telefone, l]))
    for (const telefone of lote) {
      const linha = porTelefone.get(telefone.slice(3))
      resultado[telefone] = !linha ? { telefone, estado: 'ausente' }
        : linha.quantidade !== 1 ? { telefone, estado: 'ambigua' }
          : { telefone, estado: 'encontrada', empresa: { id: linha.id, nome: linha.nome, situacao: linha.situacao } }
    }
  }
  return resultado
}
