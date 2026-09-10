import { globSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// Catraca nascida de duas ocorrências do mesmo erro: um byte NUL literal foi
// escrito dentro do parágrafo que EXPLICA o byte NUL. Aconteceu na
// `divida-tecnica.md` durante a `empresas.1` — pego antes de entrar — e de novo
// na spec de `empresas`, onde entrou e ficou.
//
// O estrago não é de renderização: é que `grep` passa a tratar o arquivo como
// binário e responde `Binary file matches` em vez das linhas. Custou uma busca
// falhada nesta mesma spec, procurando `pode_ler` para conferir uma política.
// A passagem some da ferramenta justamente no documento mais consultado.
//
// A regra é R-020: para ilustrar um caractere de controle, escreva o NOME do
// ponto de código (`U+0000`), não o caractere.
const ARQUIVOS = [...globSync('docs/**/*.md'), ...globSync('*.md')].sort()

// Tab e LF são formatação legítima em Markdown. O resto do bloco C0, mais DEL,
// é caractere de controle escrito dentro do texto.
//
// CR entra na lista, e isso só é seguro por causa do `.gitattributes`:
// `* text=auto eol=lf` normaliza o working tree para LF mesmo com
// `core.autocrlf=true` no Windows. Um CR aqui é um CR que alguém escreveu, não
// um fim de linha de checkout.
const PERMITIDOS = new Set([0x09, 0x0a])

function controlesEm(bytes: Buffer): string[] {
  const achados: string[] = []
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if ((b < 0x20 && !PERMITIDOS.has(b)) || b === 0x7f) {
      const nome = `U+${b.toString(16).toUpperCase().padStart(4, '0')}`
      // O contexto vai na mensagem porque "existe um byte 0x00 no offset 34549"
      // não diz a ninguém onde consertar.
      //
      // E vai SANEADO, com o byte trocado pelo nome dele. Medido: a primeira
      // versão colava o byte cru na mensagem, e aí a saída do próprio teste
      // virava binária — `grep` respondeu `Binary file matches` sobre ela. Uma
      // catraca que reproduz o defeito ao denunciá-lo esconde a própria
      // denúncia.
      const contexto = bytes
        .subarray(Math.max(0, i - 50), i + 20)
        .toString('utf8')
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, (c) => `«U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}»`)
        .replace(/\n/g, '\\n')
      achados.push(`byte de controle ${nome} no offset ${i}: …${contexto}…`)
    }
  }
  return achados
}

describe('documentos sem caractere de controle', () => {
  test('existe documento para varrer, senão esta catraca não vigia nada', () => {
    expect(ARQUIVOS.length).toBeGreaterThan(0)
  })

  for (const caminho of ARQUIVOS) {
    test(`${caminho} não tem caractere de controle literal`, () => {
      expect(controlesEm(readFileSync(caminho))).toEqual([])
    })
  }
})
