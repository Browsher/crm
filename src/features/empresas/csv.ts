// O numero e o da linha NO ARQUIVO, nao o indice da lista. Linha em branco no
// meio some da lista, e sem carregar o numero ela deslocaria todas as
// seguintes — o relatorio mandaria o gestor corrigir a linha errada, com cara
// de mensagem autoritativa.
export type LinhaCsv = { numero: number; campos: string[] }

export type ResultadoCsv =
  | { ok: true; linhas: LinhaCsv[] }
  | { ok: false; motivo: 'aspas_nao_fechadas'; linha: number }

// O Excel em português salva CSV com ';' por padrão; "CSV UTF-8 (delimitado
// por vírgulas)" é outra opção do mesmo menu. Farejar o cabeçalho cobre as
// duas sem perguntar nada ao gestor. Vírgula ganha no empate porque é o
// separador do nosso modelo.
function separadorDe(primeiraLinha: string): string {
  return primeiraLinha.includes(',') ? ',' : ';'
}

// Não aceita quebra de linha dentro de campo entre aspas — LIMITE DECLARADO,
// com teste próprio. Para as nove colunas desta planilha, razão social com
// quebra de linha no meio não é dado legítimo, é planilha estragada. Recusar
// com a linha na mensagem é melhor que ler errado em silêncio.
export function lerCsv(texto: string): ResultadoCsv {
  const cruas = texto.replace(/\r\n/g, '\n').split('\n')
  const separador = separadorDe(cruas[0] ?? '')
  const linhas: LinhaCsv[] = []

  for (let i = 0; i < cruas.length; i++) {
    const crua = cruas[i]
    if (crua === '') continue
    const campos: string[] = []
    let campo = ''
    let entreAspas = false
    for (let j = 0; j < crua.length; j++) {
      const c = crua[j]
      if (entreAspas) {
        if (c !== '"') {
          campo += c
        } else if (crua[j + 1] === '"') {
          campo += '"'
          j++
        } else {
          entreAspas = false
        }
      } else if (c === '"' && campo === '') {
        entreAspas = true
      } else if (c === separador) {
        campos.push(campo)
        campo = ''
      } else {
        campo += c
      }
    }
    if (entreAspas) return { ok: false, motivo: 'aspas_nao_fechadas', linha: i + 1 }
    campos.push(campo)
    linhas.push({ numero: i + 1, campos })
  }

  return { ok: true, linhas }
}
