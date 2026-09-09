import { describe, expect, test } from 'vitest'
import { analisarPlanilha, CABECALHO, type Analise } from './planilha'

const bytes = (texto: string) => new TextEncoder().encode(texto)
const comCabecalho = (...linhas: string[]) => bytes([CABECALHO, ...linhas].join('\n'))

function ok(a: Analise) {
  if (!a.ok) throw new Error(`esperava ok, veio ${a.falha.motivo}`)
  return a
}

const VALIDA = '11222333000181,Aurora Comercio LTDA,Aurora,Jose,11987654321,contato@aurora.com.br,01310100,300,sala 12'

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
          '11.222.333/0001-81,Aurora Comercio LTDA,Aurora,Jose,(11) 98765-4321,Contato@Aurora.com.br,01310-100,300,sala 12',
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
        numero: '300',
        complemento: 'sala 12',
      },
    ])
    expect(a.recusadas).toEqual([])
  })

  test('opcionais vazios viram null, nunca string vazia', () => {
    const a = ok(analisarPlanilha(comCabecalho('11222333000181,Aurora Comercio LTDA,,,11987654321,,,,')))
    expect(a.aceitas[0]).toMatchObject({
      nomeFantasia: null,
      contatoNome: null,
      email: null,
      cep: null,
      numero: null,
      complemento: null,
    })
  })
})

describe('fase 1: as recusas de campo', () => {
  const casos: [string, string, string][] = [
    ['cnpj_vazio', ',Aurora LTDA,,,11987654321,,,,', ''],
    // O valor precisa vir ENTRE ASPAS no CSV: '1,23457E+13' tem vírgula
    // dentro, e sem aspas viraria dois campos. É assim que o Excel pt-BR grava.
    ['cnpj_notacao_cientifica', '"1,23457E+13",Aurora LTDA,,,11987654321,,,,', '1,23457E+13'],
    ['cnpj_forma', '1122233300018,Aurora LTDA,,,11987654321,,,,', '1122233300018'],
    ['cnpj_dv', '11222333000182,Aurora LTDA,,,11987654321,,,,', '11222333000182'],
    ['razao_social_vazia', '11222333000181,   ,,,11987654321,,,,', '   '],
    ['telefone_vazio', '11222333000181,Aurora LTDA,,,,,,,', ''],
    ['telefone_forma', '11222333000181,Aurora LTDA,,,987654321,,,,', '987654321'],
    ['email_forma', '11222333000181,Aurora LTDA,,,11987654321,contato.aurora.com,,,', 'contato.aurora.com'],
    ['cep_curto', '11222333000181,Aurora LTDA,,,11987654321,,1310100,,', '1310100'],
    ['cep_forma', '11222333000181,Aurora LTDA,,,11987654321,,consultar,,', 'consultar'],
    ['endereco_sem_cep', '11222333000181,Aurora LTDA,,,11987654321,,,300,', '300'],
    ['colunas_de_menos', '11222333000181,Aurora LTDA', '2'],
  ]
  for (const [motivo, linha, valor] of casos) {
    test(`recusa ${motivo}`, () => {
      const a = ok(analisarPlanilha(comCabecalho(linha)))
      expect(a.aceitas).toEqual([])
      expect(a.recusadas).toEqual([{ tipo: 'campo', linha: 2, motivo, valor }])
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

  test('linha valida no meio de duas repetidas sobrevive', () => {
    const outra = '11444777000161,Bela Luz LTDA,,,1134567890,,,,'
    const a = ok(analisarPlanilha(comCabecalho(VALIDA, outra, VALIDA)))
    expect(a.aceitas.map((l) => l.cnpj)).toEqual(['11444777000161'])
    expect(a.recusadas).toHaveLength(2)
  })
})
