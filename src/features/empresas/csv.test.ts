import { describe, expect, test } from 'vitest'
import { lerCsv } from './csv'

function linhas(texto: string): string[][] {
  const r = lerCsv(texto)
  if (!r.ok) throw new Error(`esperava ok, veio ${r.motivo}`)
  return r.linhas.map((l) => l.campos)
}

function numeros(texto: string): number[] {
  const r = lerCsv(texto)
  if (!r.ok) throw new Error(`esperava ok, veio ${r.motivo}`)
  return r.linhas.map((l) => l.numero)
}

describe('lerCsv: o basico', () => {
  test('duas colunas, duas linhas', () => {
    expect(linhas('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  test('CRLF e tratado como LF', () => {
    expect(linhas('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  test('linha vazia no fim nao vira linha', () => {
    expect(linhas('a,b\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  test('campo vazio sobrevive', () => {
    expect(linhas('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ])
  })
})

describe('lerCsv: aspas', () => {
  test('separador dentro de aspas nao separa', () => {
    expect(linhas('a,b\n"Aurora, Comercio LTDA",2')).toEqual([
      ['a', 'b'],
      ['Aurora, Comercio LTDA', '2'],
    ])
  })

  test('aspas escapadas viram uma aspa', () => {
    expect(linhas('a\n"Casa ""do"" Lustre"')).toEqual([['a'], ['Casa "do" Lustre']])
  })

  test('aspas no meio de campo sem aspas sao literais', () => {
    expect(linhas('a\nCasa "do" Lustre')).toEqual([['a'], ['Casa "do" Lustre']])
  })
})

describe('lerCsv: separador ponto e virgula', () => {
  test('farejado do cabecalho, que e onde o Excel pt-BR estraga', () => {
    expect(linhas('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  test('virgula ganha quando as duas aparecem no cabecalho', () => {
    expect(linhas('a,b;c\n1,2;3')).toEqual([
      ['a', 'b;c'],
      ['1', '2;3'],
    ])
  })
})

// O LIMITE DECLARADO. Quebra de linha dentro de campo entre aspas e o canto
// que mais aparece em CSV do Excel, e este leitor NAO o suporta. O teste existe
// para provar que ele RECUSA com a linha na mensagem, em vez de ler errado em
// silencio. Limite declarado vale mais que limite implicito.
describe('lerCsv: o que ele nao faz', () => {
  test('quebra de linha dentro de aspas e recusada, com a linha', () => {
    expect(lerCsv('a,b\n"Rua das\nFlores",2')).toEqual({ ok: false, motivo: 'aspas_nao_fechadas', linha: 2 })
  })

  test('aspa aberta no fim do arquivo tambem e recusada', () => {
    expect(lerCsv('a\n"sem fim')).toEqual({ ok: false, motivo: 'aspas_nao_fechadas', linha: 2 })
  })
})

// O numero e o do ARQUIVO, nao o do array. Linha em branco no meio some da
// lista e NAO pode deslocar as seguintes: quem le o relatorio abre a planilha
// e vai na linha que a mensagem disser.
describe('lerCsv: numero da linha no arquivo', () => {
  test('sem linha em branco, numera 1, 2, 3', () => {
    expect(numeros('a\n1\n2')).toEqual([1, 2, 3])
  })

  test('linha em branco no meio nao desloca as seguintes', () => {
    expect(numeros('a\n1\n\n3')).toEqual([1, 2, 4])
  })

  test('varias em branco seguidas', () => {
    expect(numeros('a\n\n\n\n5')).toEqual([1, 5])
  })

  test('aspas nao fechadas depois de linha em branco reportam a linha do arquivo', () => {
    expect(lerCsv('a\n\n"sem fim')).toEqual({ ok: false, motivo: 'aspas_nao_fechadas', linha: 3 })
  })
})
