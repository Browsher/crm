import { criarCsvDrive, lerManifestoDrive, matrizSheetsDrive, type ManifestoDrive } from './arquivos-drive'

export type SinalColetaPronta = { versao: 1; lote: string; origemCsvSha256: string; planilhaId: string; origemId: number; pastaId: string; arquivoOriginalId: string }
export type ContagensAutomaticas = { empresasLidas: number; empresasExportadas: number; validos: number; invalidos: number; pendencias: number }
type Falha = { ok: false; motivo: string }
const PREFIXO = 'CRM_AUTOMATICO_V1:'
const CAMPOS = ['versao','lote','origemCsvSha256','planilhaId','origemId','pastaId','arquivoOriginalId'] as const
const CONTAGENS = ['empresasLidas','empresasExportadas','validos','invalidos','pendencias'] as const
const idValido = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]+$/.test(v)
const textoValido = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim() && !/[\u0000-\u001f\u007f]/.test(v)
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const falha = (motivo: string): Falha => ({ ok: false, motivo })

export function validarSinalColetaPronta(valor: unknown, destinos: { planilhaId: string; origemId: number }): Falha | { ok: true; sinal: SinalColetaPronta } {
  if (!objeto(valor) || Object.keys(valor).length !== CAMPOS.length || CAMPOS.some(c => !(c in valor))
    || valor.versao !== 1 || !textoValido(valor.lote) || typeof valor.origemCsvSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(valor.origemCsvSha256) || !idValido(valor.planilhaId) || !idValido(valor.pastaId)
    || !idValido(valor.arquivoOriginalId) || !Number.isSafeInteger(valor.origemId) || Number(valor.origemId) < 0
    || valor.planilhaId !== destinos.planilhaId || valor.origemId !== destinos.origemId) return falha('sinal_coleta_invalido')
  return { ok: true, sinal: valor as SinalColetaPronta }
}
export function conferirPublicacaoAutomatica(sinal: SinalColetaPronta, valores: unknown, nota: unknown, raizId: string): Falha | { ok: true; manifesto: ManifestoDrive } {
  const origem = lerManifestoDrive(nota,raizId)
  if (!origem.ok) return origem
  const m = origem.manifesto
  const csv = criarCsvDrive(matrizSheetsDrive(valores))
  if (!m || !csv.ok || m.tipo !== 'origem' || m.estado !== 'salvo' || m.lote !== sinal.lote
    || m.csvSha256 !== sinal.origemCsvSha256 || m.csvSha256 !== csv.csvSha256 || m.linhas !== csv.linhas
    || m.pastaId !== sinal.pastaId || m.arquivoId !== sinal.arquivoOriginalId) return falha('publicacao_origem_divergente')
  return { ok: true, manifesto: m }
}
function contagensValidas(valor: unknown): valor is ContagensAutomaticas {
  return objeto(valor) && Object.keys(valor).length === CONTAGENS.length
    && CONTAGENS.every(c => Number.isSafeInteger(valor[c]) && Number(valor[c]) >= 0)
    && Number(valor.empresasExportadas) <= Number(valor.empresasLidas)
}
export function escreverAssinaturaAutomatica(nota: string, sinal: SinalColetaPronta, contagens: ContagensAutomaticas): string {
  const humano = nota.split(/\r?\n/).filter(l => !l.startsWith(PREFIXO)).join('\n').replace(/\n+$/,'')
  return (humano ? humano + '\n' : '') + PREFIXO + JSON.stringify({ versao: 1, sinal, contagens })
}
export function conferirExportacaoAutomatica(sinal: SinalColetaPronta, manifesto: ManifestoDrive | null, nota: string, empresasLidas: number): Falha | { ok: true; mesmoLote: boolean; contagens?: ContagensAutomaticas } {
  const linhas = nota.split(/\r?\n/).filter(l => l.startsWith(PREFIXO))
  let assinatura: { sinal: SinalColetaPronta; contagens: ContagensAutomaticas } | undefined
  if (linhas.length) {
    try {
      const a = JSON.parse(linhas[0].slice(PREFIXO.length))
      if (linhas.length !== 1 || !objeto(a) || a.versao !== 1 || !objeto(a.sinal)
        || !validarSinalColetaPronta(a.sinal,{ planilhaId: sinal.planilhaId, origemId: sinal.origemId }).ok
        || !contagensValidas(a.contagens) || !manifesto || a.sinal.lote !== manifesto.lote
        || a.sinal.pastaId !== manifesto.pastaId || a.contagens.empresasExportadas !== manifesto.linhas) return falha('assinatura_automatica_invalida')
      assinatura = a as typeof assinatura
    } catch { return falha('assinatura_automatica_invalida') }
  }
  if (!manifesto || manifesto.lote !== sinal.lote) return { ok: true, mesmoLote: false }
  if (manifesto.tipo !== 'exportacao' || manifesto.pastaId !== sinal.pastaId) return falha('assinatura_origem_conflitante')
  if (assinatura) {
    if (CAMPOS.some(c => assinatura!.sinal[c] !== sinal[c]) || assinatura.contagens.empresasLidas !== empresasLidas) return falha('assinatura_origem_conflitante')
    return { ok: true, mesmoLote: true, contagens: assinatura.contagens }
  }
  // Legados concluídos preservam o resultado conhecido. Não se inventa hash
  // histórico nem se reprocessa uma exportação porque falta o marcador novo.
  const blocos = nota.split(/(?=^Execução: )/m)
  const bloco = blocos.filter(b => b.split(/\r?\n/)[0] === 'Execução: ' + manifesto.execucaoId).at(-1)
  if (!bloco || !/^Situação: concluído(?: com pendências)?\r?$/m.test(bloco)) return falha('resultado_legado_inconferivel')
  const ler = (nome: string) => {
    const encontrados = bloco.match(new RegExp('^' + nome + ': ([0-9]+)\\r?$', 'gm'))
    return encontrados?.length === 1 ? Number(encontrados[0].split(': ')[1]) : NaN
  }
  const contagens = { empresasLidas, empresasExportadas: ler('exportadas'), validos: ler('válidos'), invalidos: ler('inválidos'), pendencias: ler('pendências') }
  if (!contagensValidas(contagens) || contagens.empresasExportadas !== manifesto.linhas) return falha('resultado_legado_inconferivel')
  return { ok: true, mesmoLote: true, contagens }
}
export function montarRespostaAutomatica(sinal: SinalColetaPronta, manifesto: ManifestoDrive, contagens: ContagensAutomaticas, estado: 'concluido' | 'ja_concluido') {
  if (manifesto.tipo !== 'exportacao' || manifesto.estado !== 'salvo' || !idValido(manifesto.arquivoId)
    || !textoValido(manifesto.execucaoId) || manifesto.lote !== sinal.lote || manifesto.pastaId !== sinal.pastaId
    || !contagensValidas(contagens) || contagens.empresasExportadas !== manifesto.linhas) return falha('resultado_automatico_invalido')
  return { ok: true as const, resposta: { versao: 1 as const, estado, lote: sinal.lote, origemCsvSha256: sinal.origemCsvSha256,
    execucaoId: manifesto.execucaoId, ...contagens, mensagensEnviadas: 0 as const,
    arquivoDrive: { id: manifesto.arquivoId, pastaId: manifesto.pastaId,
      link: 'https://drive.google.com/file/d/' + manifesto.arquivoId + '/view', nome: manifesto.nome, csvSha256: manifesto.csvSha256 } } }
}
