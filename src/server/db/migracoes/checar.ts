type Arquivo = { nome: string; conteudo: string }
export type ResultadoChecagem = { ok: true } | { ok: false; problemas: string[] }

const NOME = /^(\d{4})_[a-z0-9_]+\.sql$/
const FORNECEDOR =
  /\b(auth|storage|realtime|vault|graphql_public|extensions)\.|\bsupabase\w*|\bauthenticated\b|\banon\b/i
const FORA_DE_TRANSACAO = /\bCREATE\s+INDEX\s+CONCURRENTLY\b|\bVACUUM\b|\bCREATE\s+DATABASE\b|\bALTER\s+SYSTEM\b/i
// Linha cujo texto aparado é exatamente BEGIN; COMMIT; ROLLBACK; ou começa com SAVEPOINT.
// `DO $$ BEGIN ... END $$;` e o BEGIN sem ponto e vírgula do plpgsql não casam.
const CONTROLE = /^\s*(BEGIN;|COMMIT;|ROLLBACK;|SAVEPOINT\b.*)\s*$/i
const CREATE_TABLE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w.]+\s*\(([\s\S]*?)\);/gi

function linhas(conteudo: string): string[] {
  const l = conteudo.split(/\r?\n/)
  while (l.length && l[0].trim() === '') l.shift()
  while (l.length && l[l.length - 1].trim() === '') l.pop()
  return l
}

function checarUm(arq: Arquivo): string[] {
  const p: string[] = []
  const pre = (m: string) => `${arq.nome}: ${m}`
  if (!NOME.test(arq.nome)) p.push(pre('nome fora do padrão NNNN_nome_com_underscore.sql'))

  const ls = linhas(arq.conteudo)
  let inicio = 0
  if (ls[0]?.startsWith('--')) {
    if (ls[0].length > 120) p.push(pre('comentário de topo com mais de 120 caracteres'))
    inicio = 1
  }
  if (ls[inicio]?.trim() !== 'BEGIN;') p.push(pre('primeira linha de código precisa ser BEGIN;'))
  if (ls[ls.length - 1]?.trim() !== 'COMMIT;') p.push(pre('última linha precisa ser COMMIT;'))

  const corpo = ls.slice(inicio + 1, -1)
  corpo.forEach((linha, i) => {
    const n = inicio + i + 2
    if (linha.includes('--')) p.push(pre(`linha ${n}: comentário só é permitido na primeira linha do arquivo`))
    if (linha.includes('/*')) p.push(pre(`linha ${n}: comentário de bloco não é permitido`))
    if (CONTROLE.test(linha)) p.push(pre(`linha ${n}: controle de transação só nas pontas do arquivo`))
  })

  const texto = corpo.join('\n')
  if (/\bDROP\s+TABLE\b/i.test(texto)) p.push(pre('DROP TABLE não é permitido'))
  if (/\bDROP\s+COLUMN\b/i.test(texto)) p.push(pre('DROP COLUMN não é permitido'))
  if (FORA_DE_TRANSACAO.test(texto)) p.push(pre('comando que não roda dentro de transação'))
  if (FORNECEDOR.test(texto)) p.push(pre('referência a schema ou papel de fornecedor'))

  for (const m of texto.matchAll(CREATE_TABLE)) {
    const pk = m[1].split('\n').find((c) => /PRIMARY\s+KEY/i.test(c)) ?? ''
    const uuidGerado = /uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i.test(pk)
    const pkQueEhFk = /uuid\s+PRIMARY\s+KEY\s+REFERENCES/i.test(pk)
    const pkTextual = /text\s+PRIMARY\s+KEY/i.test(pk)
    if (!uuidGerado && !pkQueEhFk && !pkTextual) p.push(pre('CREATE TABLE sem PK uuid DEFAULT gen_random_uuid()'))
  }
  return p
}

export function checarMigracoes(arquivos: Arquivo[]): ResultadoChecagem {
  const problemas = arquivos.flatMap(checarUm)
  const numeros = arquivos
    .map((a) => a.nome.match(NOME)?.[1])
    .filter((n): n is string => !!n)
    .map(Number)
    .sort((a, b) => a - b)
  numeros.forEach((n, i) => {
    if (n !== i) {
      problemas.push(`numeração: esperado ${String(i).padStart(4, '0')}, encontrado ${String(n).padStart(4, '0')}`)
    }
  })
  return problemas.length ? { ok: false, problemas } : { ok: true }
}
