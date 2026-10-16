// Portável para o Code node: sem módulos externos, eval ou APIs de rede.
type Falha = { ok: false; motivo: string; faltas?: string[] }
export type RegiaoDrive = { bairro: string; cidade: string; uf: string; dataColeta: string }
export type ManifestoDrive = RegiaoDrive & {
  versao: 1; tipo: 'origem' | 'exportacao'; raizId: string; pastaId: string; lote: string
  nome: string; csvSha256: string; linhas: number; estado: 'pendente' | 'salvo'
  arquivoId?: string; execucaoId?: string; dataExecucao?: string
}
export type ContextoDrive = RegiaoDrive & {
  raizId: string; pastaId: string; lote: string; legado?: boolean
  arquivoId?: string; nome?: string; csvSha256?: string; linhas?: number
}
const PREFIXO = 'CRM_DRIVE_V1:'
const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))
const idValido = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]+$/.test(v)
const textoValido = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v === v.trim()
  && !/[\u0000-\u001f\u007f]/.test(v)

function diaValido(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(v + 'T00:00:00.000Z')
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v
}
function dataValida(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)) return false
  const d = new Date(v)
  return Number.isFinite(d.valueOf()) && d.toISOString() === (v.length === 20 ? v.slice(0,-1) + '.000Z' : v)
}
function bytesUtf8(texto: string): number[] {
  const bytes: number[] = []
  for (const char of texto) {
    const p = char.codePointAt(0)!
    if (p >= 0xd800 && p <= 0xdfff) throw new Error('unicode_invalido')
    if (p < 0x80) bytes.push(p)
    else if (p < 0x800) bytes.push(0xc0 | p >> 6, 0x80 | p & 63)
    else if (p < 0x10000) bytes.push(0xe0 | p >> 12, 0x80 | p >> 6 & 63, 0x80 | p & 63)
    else bytes.push(0xf0 | p >> 18, 0x80 | p >> 12 & 63, 0x80 | p >> 6 & 63, 0x80 | p & 63)
  }
  return bytes
}
// SHA-256 FIPS 180-4; usa operações uint32 e bytes UTF-8 explícitos.
// Evita require('crypto'), cuja permissão varia entre instalações do n8n.
function sha256(bytes: number[]): string {
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
  const dados = [...bytes, 0x80]
  while (dados.length % 64 !== 56) dados.push(0)
  const bits = bytes.length * 8
  for (let i = 7; i >= 0; i--) dados.push(Math.floor(bits / 2 ** (8 * i)) & 255)
  const rr = (n: number, b: number) => n >>> b | n << (32 - b)
  for (let inicio = 0; inicio < dados.length; inicio += 64) {
    const w: number[] = []
    for (let i = 0; i < 16; i++) w[i] = dados[inicio+i*4] << 24 | dados[inicio+i*4+1] << 16 | dados[inicio+i*4+2] << 8 | dados[inicio+i*4+3]
    for (let i = 16; i < 64; i++) {
      const x = w[i-15], y = w[i-2]
      w[i] = (w[i-16] + (rr(x,7)^rr(x,18)^x>>>3) + w[i-7] + (rr(y,17)^rr(y,19)^y>>>10)) | 0
    }
    let [a,b,c,d,e,f,g,t] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (t + (rr(e,6)^rr(e,11)^rr(e,25)) + (e&f^~e&g) + k[i] + w[i]) | 0
      const t2 = ((rr(a,2)^rr(a,13)^rr(a,22)) + (a&b^a&c^b&c)) | 0
      t=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0
    }
    const v=[a,b,c,d,e,f,g,t]
    for (let i=0;i<8;i++) h[i]=(h[i]+v[i])|0
  }
  return h.map(v => (v >>> 0).toString(16).padStart(8,'0')).join('')
}
export function criarCsvDrive(valor: unknown): Falha | {
  ok: true; csv: string; csvSha256: string; bytes: number; linhas: number; matriz: string[][]
} {
  if (!Array.isArray(valor) || !valor.length || !Array.isArray(valor[0]) || !valor[0].length
    || !valor.every(l => Array.isArray(l) && l.length === valor[0].length && l.every(c => typeof c === 'string'))
    || valor[0].every((v: string) => !v.trim())) return { ok: false, motivo: 'csv_invalido' }
  try {
    const matriz = valor as string[][]
    const csv = '\ufeff' + matriz.map(l => l.map(c => '"' + c.replace(/"/g,'""') + '"').join(',') + '\r\n').join('')
    const bytes = bytesUtf8(csv)
    return { ok: true, csv, csvSha256: sha256(bytes), bytes: bytes.length, linhas: matriz.length - 1, matriz }
  } catch { return { ok: false, motivo: 'csv_invalido' } }
}
export function matrizSheetsDrive(valor: unknown): string[][] | null {
  if (!Array.isArray(valor) || !valor.length || !Array.isArray(valor[0]) || !valor[0].length) return null
  const largura = valor[0].length
  if (!valor.every(l => Array.isArray(l) && l.length <= largura && l.every(c => typeof c === 'string'))) return null
  const matriz = valor.map(l => Array.from({ length: largura }, (_, i) => l[i] ?? ''))
  while (matriz.length > 1 && matriz.at(-1)!.every(c => c === '')) matriz.pop()
  return matriz
}
export function nomeSeguroDrive(valor: string): string {
  const chars = [...valor]
  return chars.map(c => {
    const separador = c === '-'
    if (!separador && !/[%<>:"/\\|?*\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(c)) return c
    return bytesUtf8(c).map(b => '%' + b.toString(16).toUpperCase().padStart(2,'0')).join('')
  }).join('')
}
export function nomePastaDrive(r: RegiaoDrive): string {
  return r.dataColeta + ' - ' + nomeSeguroDrive(r.bairro) + ' - ' + nomeSeguroDrive(r.cidade) + (r.uf ? '-' + r.uf : '')
}
export function lerManifestoDrive(nota: unknown, raizId: string): Falha | { ok: true; manifesto: ManifestoDrive | null } {
  if (nota === undefined || nota === null) return { ok: true, manifesto: null }
  if (typeof nota !== 'string') return { ok: false, motivo: 'manifesto_drive_invalido' }
  const linhas = nota.split(/\r?\n/).filter(l => l.startsWith(PREFIXO))
  if (!linhas.length) return { ok: true, manifesto: null }
  try {
    if (linhas.length !== 1) throw new Error()
    const m = JSON.parse(linhas[0].slice(PREFIXO.length))
    if (!m || m.versao !== 1 || !['origem','exportacao'].includes(m.tipo) || m.raizId !== raizId
      || !idValido(m.raizId) || !idValido(m.pastaId) || !textoValido(m.bairro) || !textoValido(m.cidade)
      || !(typeof m.uf === 'string' && (UFS.has(m.uf) || m.uf === '' && m.tipo === 'exportacao'))
      || !diaValido(m.dataColeta) || !textoValido(m.lote) || !textoValido(m.nome)
      || /[<>:"/\\|?*\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(m.nome) || !m.nome.endsWith('.csv')
      || !/^[a-f0-9]{64}$/.test(m.csvSha256) || !Number.isSafeInteger(m.linhas) || m.linhas < 0
      || !['pendente','salvo'].includes(m.estado) || m.estado === 'salvo' && !idValido(m.arquivoId)
      || m.estado === 'pendente' && m.arquivoId !== undefined
      || m.tipo === 'origem' && m.estado !== 'salvo'
      || m.tipo === 'exportacao' && (!textoValido(m.execucaoId) || !dataValida(m.dataExecucao))) throw new Error()
    return { ok: true, manifesto: m as ManifestoDrive }
  } catch { return { ok: false, motivo: 'manifesto_drive_invalido' } }
}
export function escreverManifestoDrive(nota: string, manifesto: ManifestoDrive): string {
  const humano = nota.split(/\r?\n/).filter(l => !l.startsWith(PREFIXO)).join('\n').replace(/\n+$/,'')
  return (humano ? humano + '\n' : '') + PREFIXO + JSON.stringify(manifesto)
}
export function resolverOrigemDrive(valor: unknown, nota: unknown, raizId: string): Falha | { ok: true; contexto: ContextoDrive } {
  const matriz = matrizSheetsDrive(valor)
  const csv = criarCsvDrive(matriz)
  if (!csv.ok) return csv
  const r = lerManifestoDrive(nota, raizId)
  if (!r.ok) return r
  if (r.manifesto) {
    const m = r.manifesto
    if (m.tipo !== 'origem' || m.csvSha256 !== csv.csvSha256 || m.linhas !== csv.linhas) return { ok: false, motivo: 'origem_drive_divergente' }
    return { ok: true, contexto: { ...m, legado: false } }
  }
  const h = csv.matriz[0]
  const campos = ['bairro','cidade','data_coleta']
  const faltas = campos.filter(c => h.filter(v => v === c).length !== 1)
  if (faltas.length || csv.linhas === 0) return { ok: false, motivo: 'contexto_origem_ausente', faltas: faltas.length ? faltas : ['linhas_com_regiao'] }
  const regioes: RegiaoDrive[] = []
  for (const linha of csv.matriz.slice(1)) {
    const bairro = linha[h.indexOf('bairro')]
    let cidade = linha[h.indexOf('cidade')]
    let uf = h.includes('uf') ? linha[h.indexOf('uf')] : ''
    const data = linha[h.indexOf('data_coleta')]
    // Formatos legados publicados: YYYY-MM-DD, YYYY-MM-DD HH:mm:ss e ISO UTC.
    const padrao = /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2}|T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/
    const cidadeUf = cidade.match(/^(.+)\/([A-Z]{2})$/)
    if (cidadeUf) {
      if (uf && uf !== cidadeUf[2]) return { ok: false, motivo: 'contexto_origem_ambiguo' }
      cidade = cidadeUf[1]; uf = cidadeUf[2]
    }
    if (!textoValido(bairro) || !textoValido(cidade) || uf && !UFS.has(uf)
      || !padrao.test(data) || !diaValido(data.slice(0,10))
      || data.length > 10 && !dataValida(data.replace(' ','T').replace(/Z?$/, 'Z'))) {
      return { ok: false, motivo: 'contexto_origem_ausente' }
    }
    const dataColeta = data.endsWith('Z') ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(data)) : data.slice(0,10)
    regioes.push({ bairro, cidade, uf, dataColeta })
  }
  if (new Set(regioes.map(r => JSON.stringify(r))).size !== 1) return { ok: false, motivo: 'contexto_origem_ambiguo' }
  return { ok: true, contexto: { ...regioes[0], raizId, pastaId: '', lote: 'manual-' + csv.csvSha256.slice(0,20), legado: true } }
}
export function criarExportacaoDrive(origem: ContextoDrive, matriz: unknown, execucao: { id: string; data: string }): Falha | {
  ok: true; manifesto: ManifestoDrive; csv: string; bytes: number
} {
  const csv = criarCsvDrive(matriz)
  if (!csv.ok) return csv
  if (!textoValido(execucao.id) || !dataValida(execucao.data) || !idValido(origem.pastaId)) return { ok: false, motivo: 'contexto_drive_invalido' }
  const partes = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(execucao.data))
  const nome = 'Planilha exportar CRM - ' + partes.replace(' ','_').replace(/:/g,'-') + ' - exec-' + nomeSeguroDrive(execucao.id) + '.csv'
  const manifesto: ManifestoDrive = { versao: 1, tipo: 'exportacao', raizId: origem.raizId, pastaId: origem.pastaId,
    bairro: origem.bairro, cidade: origem.cidade, uf: origem.uf, dataColeta: origem.dataColeta, lote: origem.lote,
    nome, csvSha256: csv.csvSha256, linhas: csv.linhas, estado: 'pendente', execucaoId: execucao.id, dataExecucao: execucao.data }
  return { ok: true, manifesto, csv: csv.csv, bytes: csv.bytes }
}
export function conferirPastaDrive(valor: unknown, raizId: string, pastaId: string): Falha | { ok: true } {
  const p = valor as Record<string, unknown> | null
  if (!p || p.id !== pastaId || !idValido(p.id) || p.mimeType !== 'application/vnd.google-apps.folder'
    || p.trashed !== false || !Array.isArray(p.parents) || p.parents.length !== 1 || p.parents[0] !== raizId) return { ok: false, motivo: 'pasta_drive_invalida' }
  return { ok: true }
}
export function queryArquivoDrive(pastaId: string, nome: string): string {
  const literal = (v: string) => "'" + v.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "'"
  return literal(pastaId) + ' in parents and name = ' + literal(nome) + ' and trashed = false'
}
