import type { FonteMaps } from '../../lib/prospeccao-base/modelo'

export type EntradaMaps =
  | { ok: true; fontes: FonteMaps[] }
  | { ok: false; motivo: 'entrada_invalida'; detalhes: string[] }

const REQUERIDAS = ['place_id', 'nome_empresa', 'cnpj', 'telefone', 'endereco', 'link_maps'] as const
const CONTROLE = /[\u0000-\u001f\u007f-\u009f]/u

export function lerFontesMaps(linhas: Record<string, unknown>[]): EntradaMaps {
  const detalhes: string[] = []
  const fontes: FonteMaps[] = []
  for (const [indice, linha] of linhas.entries()) {
    if (typeof linha !== 'object' || linha === null || Array.isArray(linha)) {
      detalhes.push('Linha ' + (indice + 2) + ': objeto esperado')
      continue
    }
    if (REQUERIDAS.some(c => typeof linha[c] !== 'string') ||
      Object.values(linha).some(v => typeof v !== 'string')) {
      detalhes.push('Linha ' + (indice + 2) + ': campos ausentes ou não textuais')
      continue
    }
    const fonte = { ...linha } as FonteMaps
    if (!fonte.place_id.trim() || [...fonte.place_id].length > 255 ||
      CONTROLE.test(fonte.place_id) || !fonte.nome_empresa.trim()) {
      detalhes.push('Linha ' + (indice + 2) + ': identidade ou nome inválido')
      continue
    }
    fontes.push(fonte)
  }
  return detalhes.length ? { ok: false, motivo: 'entrada_invalida', detalhes } : { ok: true, fontes }
}
