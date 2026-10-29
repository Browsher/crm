import { validarUnicidade } from './consolidar'
import type { Base, ColetaEntrada, EmpresaBase, FonteMaps, LinhaAba, Ocorrencia, TelefoneBase } from './modelo'

export type Abas = Record<'Empresas' | 'Telefones' | 'Coletas', LinhaAba[]>
export const CABECALHOS_ABAS = {
  Empresas: ['id', 'place_id', 'place_ids', 'cnpj', 'nome', 'razao_social', 'categoria', 'segmento',
    'telefone_publicado', 'telefone_normalizado', 'email', 'site', 'endereco_publicado', 'bairro', 'cep', 'cidade', 'uf',
    'link_maps', 'fonte_endereco', 'coletas_ids', 'data_coleta', 'revisao', 'observacoes', 'dados_publicados'],
  Telefones: ['numero', 'tipo', 'empresas_ids', 'quantidade_empresas', 'whatsapp', 'numero_retornado', 'jid',
    'verificado_em', 'http', 'motivo', 'revalidar'],
  Coletas: ['chave', 'coleta_id', 'execucao_id', 'tipo', 'fonte', 'regiao', 'termos', 'data', 'arquivo', 'sha256',
    'linha', 'empresa_id', 'fonte_original', 'motivos', 'contagens'],
} as const
const STRING = (valor: string | null | undefined) => valor ?? ''
export function serializarAbas(base: Base): Abas {
  const abas: Abas = {
    Empresas: base.empresas.map(e => ({
      id: e.id, place_id: e.publicados.place_id, place_ids: JSON.stringify(e.placeIds), cnpj: STRING(e.cnpj),
      nome: e.publicados.nome_empresa, razao_social: STRING(e.publicados.razao_social),
      categoria: STRING(e.publicados.categoria), segmento: STRING(e.publicados.segmento),
      telefone_publicado: e.publicados.telefone, telefone_normalizado: STRING(e.telefoneNormalizado),
      email: STRING(e.publicados.email), site: STRING(e.publicados.site), endereco_publicado: e.publicados.endereco,
      bairro: STRING(e.publicados.bairro), cep: STRING(e.publicados.cep), cidade: STRING(e.publicados.cidade),
      uf: STRING(e.publicados.estado), link_maps: e.publicados.link_maps, fonte_endereco: STRING(e.publicados.situacao_endereco),
      coletas_ids: JSON.stringify(e.coletas), data_coleta: STRING(e.publicados.data_coleta),
      revisao: e.revisao, observacoes: e.observacoes, dados_publicados: JSON.stringify(e.publicados),
    })),
    Telefones: base.telefones.map(t => ({
      numero: t.numero, tipo: t.tipo, empresas_ids: JSON.stringify(t.empresas), quantidade_empresas: String(t.empresas.length),
      whatsapp: t.estado, numero_retornado: STRING(t.numeroRetornado), jid: STRING(t.jid),
      verificado_em: STRING(t.verificadoEm), http: t.statusHTTP === null ? '' : String(t.statusHTTP),
      motivo: STRING(t.motivo), revalidar: t.revalidar ? 'sim' : 'nao',
    })),
    Coletas: base.coletas.map(o => ({
      chave: o.chave, coleta_id: o.coleta.id, execucao_id: o.coleta.execucaoId, tipo: o.tipo,
      fonte: o.coleta.fonte, regiao: o.coleta.regiao, termos: JSON.stringify(o.coleta.termos), data: o.coleta.data,
      arquivo: o.coleta.arquivo, sha256: o.coleta.sha256, linha: o.linha === null ? '' : String(o.linha),
      empresa_id: STRING(o.empresaId), fonte_original: JSON.stringify(o.fonteOriginal),
      motivos: JSON.stringify(o.motivos), contagens: JSON.stringify(o.contagens),
    })),
  }
  for (const [aba, linhas] of Object.entries(abas)) {
    for (const [indice, linha] of linhas.entries()) {
      for (const [coluna, valor] of Object.entries(linha)) {
        if (valor.length > 49000) throw new Error('Célula excede 49000: ' + aba + '/' + (indice + 2) + '/' + coluna)
      }
    }
  }
  return abas
}
function lista(valor: unknown): string[] | null {
  return Array.isArray(valor) && valor.every(v => typeof v === 'string') ? valor : null
}
function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}
function fonte(valor: unknown): FonteMaps | null {
  if (!objeto(valor) || Object.values(valor).some(v => typeof v !== 'string') ||
    ['place_id', 'nome_empresa', 'cnpj', 'telefone', 'endereco', 'link_maps'].some(c => typeof valor[c] !== 'string')) return null
  return valor as FonteMaps
}
function json(valor: string): unknown {
  try { return JSON.parse(valor) } catch { return undefined }
}
function campos(linha: Record<string, unknown>, chaves: readonly string[]): LinhaAba | null {
  const normalizada = { ...linha }
  if (typeof normalizada.quantidade_empresas === 'number' && Number.isSafeInteger(normalizada.quantidade_empresas)) {
    normalizada.quantidade_empresas = String(normalizada.quantidade_empresas)
  }
  if (chaves.some(c => typeof normalizada[c] !== 'string')) return null
  return Object.fromEntries(chaves.map(c => [c, normalizada[c] as string]))
}
function empresa(l: LinhaAba): EmpresaBase | null {
  const publicados = fonte(json(l.dados_publicados))
  const placeIds = lista(json(l.place_ids))
  const coletas = lista(json(l.coletas_ids))
  if (!publicados || !placeIds || !placeIds.length || !coletas || !l.id ||
    !['pendente', 'revisada', 'telefone_compartilhado'].includes(l.revisao) ||
    (l.telefone_normalizado && !/^55[0-9]{10,11}$/.test(l.telefone_normalizado))) return null
  const espelhados: Record<string, string> = {
    place_id: publicados.place_id, nome: publicados.nome_empresa, razao_social: STRING(publicados.razao_social),
    categoria: STRING(publicados.categoria), segmento: STRING(publicados.segmento),
    telefone_publicado: publicados.telefone, email: STRING(publicados.email), site: STRING(publicados.site),
    endereco_publicado: publicados.endereco, bairro: STRING(publicados.bairro), cep: STRING(publicados.cep),
    cidade: STRING(publicados.cidade), uf: STRING(publicados.estado), link_maps: publicados.link_maps,
    fonte_endereco: STRING(publicados.situacao_endereco), data_coleta: STRING(publicados.data_coleta),
  }
  if (Object.entries(espelhados).some(([campo, valor]) => l[campo] !== valor)) return null
  return { id: l.id, placeIds, cnpj: l.cnpj || null, publicados, telefoneNormalizado: l.telefone_normalizado || null,
    coletas, revisao: l.revisao as EmpresaBase['revisao'], observacoes: l.observacoes }
}
function telefone(l: LinhaAba): TelefoneBase | null {
  const empresas = lista(json(l.empresas_ids))
  const statusHTTP = l.http ? Number(l.http) : null
  if (!/^55[0-9]{10,11}$/.test(l.numero) || !empresas ||
    !['fixo', 'celular'].includes(l.tipo) ||
    !['pendente', 'encontrado', 'nao_encontrado', 'inconclusivo'].includes(l.whatsapp) ||
    !['sim', 'nao'].includes(l.revalidar) || Number(l.quantidade_empresas) !== empresas.length ||
    (statusHTTP !== null && (!Number.isInteger(statusHTTP) || statusHTTP < 100 || statusHTTP > 599)) ||
    (l.verificado_em && !Number.isFinite(Date.parse(l.verificado_em)))) return null
  return { numero: l.numero, tipo: l.tipo as TelefoneBase['tipo'], empresas,
    estado: l.whatsapp as TelefoneBase['estado'], numeroRetornado: l.numero_retornado || null,
    jid: l.jid || null, verificadoEm: l.verificado_em || null, statusHTTP, motivo: l.motivo || null, revalidar: l.revalidar === 'sim' }
}
function ocorrencia(l: LinhaAba): Ocorrencia | null {
  const termos = lista(json(l.termos))
  const motivos = lista(json(l.motivos))
  const original = json(l.fonte_original)
  const contagens = json(l.contagens)
  const linha = l.linha ? Number(l.linha) : null
  if (!l.chave || !l.coleta_id || !l.execucao_id || !['resumo', 'ocorrencia'].includes(l.tipo) ||
    !termos || !motivos || (original !== null && !fonte(original)) ||
    !objeto(contagens) || Object.values(contagens).some(v => !Number.isSafeInteger(v) || Number(v) < 0) ||
    (linha !== null && (!Number.isSafeInteger(linha) || linha < 2))) return null
  const coleta: ColetaEntrada = { id: l.coleta_id, execucaoId: l.execucao_id, fonte: l.fonte, regiao: l.regiao,
    termos, data: l.data, arquivo: l.arquivo, sha256: l.sha256 }
  return { chave: l.chave, coleta, tipo: l.tipo as Ocorrencia['tipo'], linha,
    empresaId: l.empresa_id || null, fonteOriginal: original as FonteMaps | null, motivos, contagens: contagens as Record<string, number> }
}
export function desserializarAbas(abas: Record<string, Record<string, unknown>[]>):
  { ok: true; base: Base } | { ok: false; motivo: 'base_invalida'; detalhes: string[] } {
  const base: Base = { empresas: [], telefones: [], coletas: [] }
  const detalhes: string[] = []
  for (const nome of ['Empresas', 'Telefones', 'Coletas'] as const) {
    if (!Array.isArray(abas[nome])) return { ok: false, motivo: 'base_invalida', detalhes: ['Aba ausente: ' + nome] }
    for (const [indice, raw] of abas[nome].entries()) {
      if (Object.keys(raw).length === 0) continue
      const l = campos(raw, CABECALHOS_ABAS[nome])
      const r = l === null ? null : nome === 'Empresas' ? empresa(l) : nome === 'Telefones' ? telefone(l) : ocorrencia(l)
      if (!r) { detalhes.push(nome + ': linha inválida ' + (indice + 2)); continue }
      if (nome === 'Empresas') base.empresas.push(r as EmpresaBase)
      else if (nome === 'Telefones') base.telefones.push(r as TelefoneBase)
      else base.coletas.push(r as Ocorrencia)
    }
  }
  detalhes.push(...validarUnicidade(base))
  return detalhes.length ? { ok: false, motivo: 'base_invalida', detalhes } : { ok: true, base }
}
