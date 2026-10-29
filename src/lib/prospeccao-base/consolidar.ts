import { normalizarCnpj, validarCnpj } from '../cnpj'
import type { Base, ColetaEntrada, Consolidacao, EmpresaBase, FonteMaps, Ocorrencia, PendenciaBase, TelefoneBase } from './modelo'
import { normalizarNumero } from './telefone'

function duplicadas(valores: string[]): string[] {
  const visto = new Set<string>()
  const repetidos = new Set<string>()
  for (const valor of valores) {
    if (visto.has(valor)) repetidos.add(valor)
    visto.add(valor)
  }
  return [...repetidos]
}

export function validarUnicidade(base: Base): string[] {
  const detalhes = [
    ...duplicadas(base.empresas.map(e => e.id)).map(v => 'empresa:' + v),
    ...duplicadas(base.empresas.flatMap(e => e.placeIds)).map(v => 'place_id:' + v),
    ...duplicadas(base.empresas.flatMap(e => e.cnpj === null ? [] : [e.cnpj])).map(v => 'cnpj:' + v),
    ...duplicadas(base.telefones.map(t => t.numero)).map(v => 'telefone:' + v),
    ...duplicadas(base.coletas.map(o => o.chave)).map(v => 'ocorrencia:' + v),
  ]
  const ids = new Set(base.empresas.map(e => e.id))
  for (const telefone of base.telefones) {
    if (duplicadas(telefone.empresas).length || telefone.empresas.some(id => !ids.has(id))) {
      detalhes.push('associacao:' + telefone.numero)
    }
  }
  return detalhes
}

function canonica(fonte: FonteMaps): string {
  return JSON.stringify(Object.fromEntries(Object.entries(fonte).sort(([a], [b]) => a.localeCompare(b))))
}

export function consolidar(base: Base, fontes: FonteMaps[], coleta: ColetaEntrada): Consolidacao {
  const erros = validarUnicidade(base)
  if (erros.length) return { ok: false, motivo: 'base_duplicada', detalhes: erros }
  if (!coleta.id || !coleta.execucaoId || fontes.length > 5000 ||
    fontes.some(f => !f.place_id.trim() || !f.nome_empresa.trim())) {
    return { ok: false, motivo: 'entrada_invalida', detalhes: ['Identidade, coleta ou quantidade inválida'] }
  }
  const resultado: Base = JSON.parse(JSON.stringify(base))
  const porId = new Map(resultado.empresas.map(e => [e.id, e]))
  const porPlace = new Map(resultado.empresas.flatMap(e => e.placeIds.map(p => [p, e] as const)))
  const porCnpj = new Map(resultado.empresas.flatMap(e => e.cnpj === null ? [] : [[e.cnpj, e] as const]))
  const porTelefone = new Map(resultado.telefones.map(t => [t.numero, t]))
  const porOcorrencia = new Map(resultado.coletas.map(o => [o.chave, o]))
  const idsAnteriores = new Set(porId.keys())
  const recebidas = new Set<string>()
  const pendencias: PendenciaBase[] = []
  const porPlaceNaEntrada = new Map<string, Set<string>>()
  for (const fonte of fontes) {
    const id = fonte.place_id.trim()
    const grupo = porPlaceNaEntrada.get(id) ?? new Set<string>()
    grupo.add(canonica(fonte))
    porPlaceNaEntrada.set(id, grupo)
  }
  const registrar = (ocorrencia: Ocorrencia) => porOcorrencia.set(ocorrencia.chave, ocorrencia)
  for (const [indice, fonte] of fontes.entries()) {
    const linha = indice + 2
    const motivos: string[] = []
    const placeId = fonte.place_id.trim()
    const cnpjLimpo = fonte.cnpj.trim() ? normalizarCnpj(fonte.cnpj) : null
    const cnpjValido = cnpjLimpo !== null && validarCnpj(cnpjLimpo) ? cnpjLimpo : null
    if (fonte.cnpj.trim() && cnpjValido === null) motivos.push('cnpj_invalido')
    const peloPlace = porPlace.get(placeId)
    const peloCnpj = cnpjValido === null ? undefined : porCnpj.get(cnpjValido)
    let bloqueada = false
    if ((porPlaceNaEntrada.get(placeId)?.size ?? 0) > 1) {
      motivos.push('place_id_repetido_divergente')
      bloqueada = true
    }
    if (peloPlace && peloCnpj && peloPlace.id !== peloCnpj.id) {
      motivos.push('identificadores_divergentes')
      bloqueada = true
    } else if (peloPlace?.cnpj && cnpjValido && peloPlace.cnpj !== cnpjValido) {
      motivos.push('cnpj_divergente')
      bloqueada = true
    }
    let empresaId: string | null = null
    if (!bloqueada) {
      const anterior = peloPlace ?? peloCnpj
      const telefone = normalizarNumero(fonte.telefone)
      const numero = telefone.ok ? telefone.numero : null
      if (!telefone.ok) motivos.push(telefone.motivo)
      if (anterior && anterior.telefoneNormalizado !== numero) motivos.push('telefone_publicado_alterado')
      const empresa: EmpresaBase = anterior ?? {
        id: 'google:' + placeId, placeIds: [], cnpj: null, publicados: { ...fonte },
        telefoneNormalizado: null, coletas: [], revisao: 'pendente', observacoes: fonte.observacoes ?? '',
      }
      empresa.placeIds = [...new Set([...empresa.placeIds, placeId])].sort()
      empresa.cnpj ??= cnpjValido
      empresa.publicados = { ...fonte }
      empresa.telefoneNormalizado = numero
      empresa.coletas = [...new Set([...empresa.coletas, coleta.id])]
      empresaId = empresa.id
      recebidas.add(empresa.id)
      porId.set(empresa.id, empresa)
      porPlace.set(placeId, empresa)
      if (empresa.cnpj) porCnpj.set(empresa.cnpj, empresa)
      if (telefone.ok) {
        const registro: TelefoneBase = porTelefone.get(telefone.numero) ?? {
          numero: telefone.numero, tipo: telefone.tipo, empresas: [], estado: 'pendente',
          numeroRetornado: null, jid: null, verificadoEm: null, statusHTTP: null, motivo: null, revalidar: false,
        }
        registro.empresas = [...new Set([...registro.empresas, empresa.id])].sort()
        porTelefone.set(registro.numero, registro)
      }
    }
    for (const motivo of motivos) pendencias.push({ linha, motivo })
    registrar({
      chave: coleta.execucaoId + ':' + linha, coleta: { ...coleta, termos: [...coleta.termos] },
      tipo: 'ocorrencia', linha, empresaId, fonteOriginal: { ...fonte }, motivos, contagens: {},
    })
  }
  for (const registro of porTelefone.values()) {
    if (registro.empresas.length < 2) continue
    for (const id of registro.empresas) {
      const empresa = porId.get(id)
      if (empresa && empresa.revisao !== 'revisada') empresa.revisao = 'telefone_compartilhado'
    }
  }
  registrar({
    chave: coleta.execucaoId + ':resumo', coleta: { ...coleta, termos: [...coleta.termos] },
    tipo: 'resumo', linha: null, empresaId: null, fonteOriginal: null, motivos: [],
    contagens: {
      empresas_recebidas: fontes.length,
      empresas_novas: [...recebidas].filter(id => !idsAnteriores.has(id)).length,
      empresas_reencontradas: [...recebidas].filter(id => idsAnteriores.has(id)).length,
      telefones_novos: porTelefone.size - base.telefones.length,
      pendencias: pendencias.length,
    },
  })
  resultado.empresas = [...porId.values()]
  resultado.telefones = [...porTelefone.values()]
  resultado.coletas = [...porOcorrencia.values()]
  const finais = validarUnicidade(resultado)
  return finais.length
    ? { ok: false, motivo: 'base_duplicada', detalhes: finais }
    : { ok: true, base: resultado, pendencias }
}
