import { describe, expect, test } from 'vitest'
import { analisarPlanilha, CABECALHO_LEGADO as CABECALHO, CABECALHO as CABECALHO_NOVO, type Analise } from './planilha'

const bytes = (texto: string) => new TextEncoder().encode(texto)
const comCabecalho = (...linhas: string[]) => bytes([CABECALHO, ...linhas].join('\n'))

function ok(a: Analise) {
  if (!a.ok) throw new Error(`esperava ok, veio ${a.falha.motivo}`)
  return a
}

const VALIDA = '11222333000181,Aurora Comercio LTDA,Aurora,Jose,11987654321,contato@aurora.com.br,01310100'

describe('fase 0: o arquivo inteiro', () => {
  test('bytes que nao sao UTF-8 recusam o arquivo', () => {
    // 0xE7 solto é 'ç' em Windows-1252 e sequência inválida em UTF-8.
    const a = analisarPlanilha(new Uint8Array([0x61, 0xe7, 0x62]))
    expect(a).toEqual({ ok: false, falha: { motivo: 'nao_utf8' } })
  })

  test('BOM no comeco nao atrapalha o cabecalho', () => {
    expect(ok(analisarPlanilha(bytes(`﻿${CABECALHO}\n${VALIDA}`))).aceitas).toHaveLength(1)
  })

  test('arquivo vazio', () => {
    expect(analisarPlanilha(bytes(''))).toEqual({ ok: false, falha: { motivo: 'vazio' } })
  })

  test('so o cabecalho, sem dados', () => {
    expect(analisarPlanilha(bytes(CABECALHO))).toEqual({ ok: false, falha: { motivo: 'vazio' } })
  })

  test('cabecalho diferente recusa o arquivo e diz o que veio', () => {
    const a = analisarPlanilha(bytes('cnpj,nome\n1,2'))
    expect(a).toEqual({ ok: false, falha: { motivo: 'cabecalho_diferente', encontrado: 'cnpj,nome' } })
  })

  test('cabecalho com ponto e virgula e aceito', () => {
    const a = analisarPlanilha(bytes(`${CABECALHO.replace(/,/g, ';')}\n${VALIDA.replace(/,/g, ';')}`))
    expect(ok(a).aceitas).toHaveLength(1)
  })

  test('aspas nao fechadas recusam o arquivo', () => {
    const a = analisarPlanilha(comCabecalho('"11222333000181,x'))
    expect(a).toEqual({ ok: false, falha: { motivo: 'aspas_nao_fechadas', linha: 2 } })
  })

  test('acima do limite recusa o arquivo', () => {
    const a = analisarPlanilha(comCabecalho(...Array.from({ length: 5001 }, () => VALIDA)))
    expect(a).toEqual({ ok: false, falha: { motivo: 'excede_limite', linhas: 5001 } })
  })
})

describe('fase 1: a linha valida', () => {
  test('vira LinhaAceita com tudo normalizado', () => {
    const a = ok(
      analisarPlanilha(
        comCabecalho(
          '11.222.333/0001-81,Aurora Comercio LTDA,Aurora,Jose,(11) 98765-4321,Contato@Aurora.com.br,01310-100',
        ),
      ),
    )
    expect(a.aceitas).toEqual([
      {
        linha: 2,
        cnpj: '11222333000181',
        razaoSocial: 'Aurora Comercio LTDA',
        nomeFantasia: 'Aurora',
        contatoNome: 'Jose',
        telefone: '11987654321',
        email: 'contato@aurora.com.br',
        cep: '01310100',
        cnaePrincipal: null,
      },
    ])
    expect(a.recusadas).toEqual([])
  })

  test('opcionais vazios viram null, nunca string vazia', () => {
    const a = ok(analisarPlanilha(comCabecalho('11222333000181,Aurora Comercio LTDA,,,11987654321,,')))
    expect(a.aceitas[0]).toMatchObject({
      nomeFantasia: null,
      contatoNome: null,
      email: null,
      cep: null,
    })
  })
})

describe('fase 1: as recusas de campo', () => {
  const casos: [string, string, string][] = [
    ['cnpj_vazio', ',Aurora LTDA,,,11987654321,,', ''],
    // O valor precisa vir ENTRE ASPAS no CSV: '1,23457E+13' tem vírgula
    // dentro, e sem aspas viraria dois campos. É assim que o Excel pt-BR grava.
    ['cnpj_notacao_cientifica', '"1,23457E+13",Aurora LTDA,,,11987654321,,', '1,23457E+13'],
    ['cnpj_forma', '1122233300018,Aurora LTDA,,,11987654321,,', '1122233300018'],
    ['cnpj_dv', '11222333000182,Aurora LTDA,,,11987654321,,', '11222333000182'],
    ['razao_social_vazia', '11222333000181,   ,,,11987654321,,', '   '],
    ['telefone_vazio', '11222333000181,Aurora LTDA,,,,,', ''],
    ['telefone_forma', '11222333000181,Aurora LTDA,,,987654321,,', '987654321'],
    ['email_forma', '11222333000181,Aurora LTDA,,,11987654321,contato.aurora.com,', 'contato.aurora.com'],
    ['cep_curto', '11222333000181,Aurora LTDA,,,11987654321,,1310100', '1310100'],
    ['cep_forma', '11222333000181,Aurora LTDA,,,11987654321,,consultar', 'consultar'],
    ['colunas_erradas', '11222333000181,Aurora LTDA', '2'],
    ['colunas_erradas', '11222333000181,Aurora LTDA,,,1134567890,,01310100,EXTRA', '8'],
    ['colunas_erradas', '11222333000181,Aurora LTDA,,,1134567890,,01310100,', '8'],
  ]
  for (const [motivo, linha, valor] of casos) {
    test(`recusa ${motivo}`, () => {
      const a = ok(analisarPlanilha(comCabecalho(linha)))
      expect(a.aceitas).toEqual([])
      expect(a.recusadas).toEqual([{ tipo: 'campo', linha: 2, motivo, valor, ...(motivo === 'colunas_erradas' ? { esperado: 7 } : {}) }])
    })
  }
})

describe('fase 1: duplicata dentro do arquivo', () => {
  test('recusa as DUAS linhas, e diz que sao identicas', () => {
    const a = ok(analisarPlanilha(comCabecalho(VALIDA, VALIDA)))
    expect(a.aceitas).toEqual([])
    expect(a.recusadas).toEqual([
      { tipo: 'repetido', linha: 2, par: 3, cnpj: '11222333000181', divergencia: null },
      { tipo: 'repetido', linha: 3, par: 2, cnpj: '11222333000181', divergencia: null },
    ])
  })

  test('quando divergem, nomeia o campo', () => {
    const outra = VALIDA.replace('11987654321', '11999998888')
    const a = ok(analisarPlanilha(comCabecalho(VALIDA, outra)))
    expect(a.recusadas).toEqual([
      { tipo: 'repetido', linha: 2, par: 3, cnpj: '11222333000181', divergencia: 'telefone' },
      { tipo: 'repetido', linha: 3, par: 2, cnpj: '11222333000181', divergencia: 'telefone' },
    ])
  })

  // O nome que sai no relatorio e o da COLUNA DA PLANILHA, nao o do campo em
  // TypeScript. Quem le procura pelo nome que digitou no cabecalho: ver
  // 'razaoSocial' num relatorio sobre um arquivo cuja coluna se chama
  // 'razao_social' manda a pessoa procurar o que nao existe.
  test('o nome e o da coluna da planilha, nao o do campo', () => {
    const outra = VALIDA.replace('Aurora Comercio LTDA', 'Aurora Comercio ME')
    const a = ok(analisarPlanilha(comCabecalho(VALIDA, outra)))
    expect(a.recusadas.map((r) => (r.tipo === 'repetido' ? r.divergencia : null))).toEqual([
      'razao_social',
      'razao_social',
    ])
  })

  test('nome_fantasia e contato_nome tambem saem com o nome da coluna', () => {
    const semFantasia = VALIDA.replace(',Aurora,Jose,', ',Aurora Luz,Jose,')
    const a = ok(analisarPlanilha(comCabecalho(VALIDA, semFantasia)))
    expect(a.recusadas.map((r) => (r.tipo === 'repetido' ? r.divergencia : null))).toEqual([
      'nome_fantasia',
      'nome_fantasia',
    ])
  })

  // Catraca contra deriva: nome de coluna no relatorio que nao existe no
  // cabecalho manda o gestor procurar o que nao ha.
  test('todo nome de coluna do relatorio existe no CABECALHO', () => {
    const colunas = new Set(CABECALHO.split(','))
    const pares: [string, string][] = [
      ['razao_social', 'Aurora Comercio ME'],
      ['nome_fantasia', 'Aurora Luz'],
      ['contato_nome', 'Maria'],
      ['telefone', '11999998888'],
      ['email', 'outro@aurora.com.br'],
      ['cep', '69900001'],
    ]
    const trocas: [string, string][] = [
      ['Aurora Comercio LTDA', 'Aurora Comercio ME'],
      [',Aurora,', ',Aurora Luz,'],
      [',Jose,', ',Maria,'],
      ['11987654321', '11999998888'],
      ['contato@aurora.com.br', 'outro@aurora.com.br'],
      ['01310100', '69900001'],
    ]
    for (const [i, [esperado]] of pares.entries()) {
      const [de, para] = trocas[i]
      const a = ok(analisarPlanilha(comCabecalho(VALIDA, VALIDA.replace(de, para))))
      const primeira = a.recusadas[0]
      const nome = primeira.tipo === 'repetido' ? primeira.divergencia : null
      expect(nome).toBe(esperado)
      expect(colunas.has(nome as string)).toBe(true)
    }
  })

  test('linha valida no meio de duas repetidas sobrevive', () => {
    const outra = '11444777000161,Bela Luz LTDA,,,1134567890,,'
    const a = ok(analisarPlanilha(comCabecalho(VALIDA, outra, VALIDA)))
    expect(a.aceitas.map((l) => l.cnpj)).toEqual(['11444777000161'])
    expect(a.recusadas).toHaveLength(2)
  })
})

describe('fase 1: numero da linha com linha em branco no meio', () => {
  test('a recusa aponta para a linha do ARQUIVO', () => {
    // linha 2 valida, 3 em branco, 4 com DV errado
    const a = ok(
      analisarPlanilha(
        bytes([CABECALHO, VALIDA, '', '11222333000182,Erro LTDA,,,1134567890,,'].join('\n')),
      ),
    )
    expect(a.aceitas.map((l) => l.linha)).toEqual([2])
    expect(a.recusadas).toEqual([{ tipo: 'campo', linha: 4, motivo: 'cnpj_dv', valor: '11222333000182' }])
  })

  test('duplicata depois de linha em branco cita as linhas certas', () => {
    const a = ok(analisarPlanilha(bytes([CABECALHO, VALIDA, '', VALIDA].join('\n'))))
    expect(a.recusadas.map((r) => r.linha)).toEqual([2, 4])
    expect(a.recusadas.map((r) => (r.tipo === 'repetido' ? r.par : null))).toEqual([4, 2])
  })
})

// Byte NUL e UTF-8 valido, entao passa pelo TextDecoder — e o Postgres recusa
// com 22021. Pegar aqui da o numero da linha; traduzir o erro do banco daria
// uma mensagem sem localizacao nenhuma.
describe('fase 1: byte NUL', () => {
  test('recusa a linha, com o numero e a coluna', () => {
    const a = ok(analisarPlanilha(bytes([CABECALHO, '11222333000181,Aurora\u0000 LTDA,,,1134567890,,'].join('\n'))))
    expect(a.aceitas).toEqual([])
    expect(a.recusadas).toEqual([
      { tipo: 'campo', linha: 2, motivo: 'caractere_invalido', valor: 'razao_social' },
    ])
  })

  test('linha limpa ao lado de linha com NUL: so a suja sai', () => {
    const suja = '11444777000161,Bela\u0000 Luz,,,1134567890,,'
    const a = ok(analisarPlanilha(bytes([CABECALHO, VALIDA, suja].join('\n'))))
    expect(a.aceitas.map((l) => l.cnpj)).toEqual(['11222333000181'])
    expect(a.recusadas.map((r) => r.linha)).toEqual([3])
  })
})


describe('CNAE e formatos de cabecalho', () => {
  const novo = (...linhas: string[]) => bytes([CABECALHO_NOVO, ...linhas].join('\n'))

  test('cabecalho novo acrescenta somente cnae_principal', () => {
    expect(CABECALHO_NOVO).toBe(`${CABECALHO},cnae_principal`)
  })

  test('legado normaliza CNAE ausente para null', () => {
    expect(ok(analisarPlanilha(comCabecalho(VALIDA))).aceitas[0].cnaePrincipal).toBe(null)
  })

  test.each([['', null], ['4742-3/00', '4742300'], ['0111301', '0111301']])('novo aceita CNAE %s', (bruto, valor) => {
    expect(ok(analisarPlanilha(novo(`${VALIDA},${bruto}`))).aceitas[0].cnaePrincipal).toBe(valor)
  })

  test('CNAE invalido recusa a linha', () => {
    expect(ok(analisarPlanilha(novo(`${VALIDA},abc4742300`))).recusadas).toEqual([
      { tipo: 'campo', linha: 2, motivo: 'cnae_forma', valor: 'abc4742300' },
    ])
  })

  test.each([[VALIDA, '7'], [`${VALIDA},4742300,extra`, '9']])('novo exige oito campos: %s', (linha, valor) => {
    expect(ok(analisarPlanilha(novo(linha))).recusadas).toEqual([
      { tipo: 'campo', linha: 2, motivo: 'colunas_erradas', valor, esperado: 8 },
    ])
  })

  test('NUL em CNAE informa a coluna', () => {
    expect(ok(analisarPlanilha(novo(`${VALIDA},474\u00002300`))).recusadas).toEqual([
      { tipo: 'campo', linha: 2, motivo: 'caractere_invalido', valor: 'cnae_principal' },
    ])
  })

  test.each([['4742300', null], ['0111301', 'cnae_principal'], ['', 'cnae_principal']])('duplicatas com CNAE %s', (segundo, divergencia) => {
    const a = ok(analisarPlanilha(novo(`${VALIDA},4742-3/00`, `${VALIDA},${segundo}`)))
    expect(a.aceitas).toEqual([])
    expect(a.recusadas.map((r) => r.tipo === 'repetido' ? r.divergencia : 'campo')).toEqual([divergencia, divergencia])
  })
})
