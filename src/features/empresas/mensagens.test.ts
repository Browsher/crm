import { describe, expect, test } from 'vitest'
import { textoDaFalhaDeArquivo, textoDaRecusa } from './mensagens'

describe('textoDaRecusa: as mensagens explicam a CAUSA, nao so o sintoma', () => {
  test('notacao cientifica manda formatar a coluna', () => {
    const t = textoDaRecusa({ tipo: 'campo', linha: 12, motivo: 'cnpj_notacao_cientifica', valor: '1,23457E+13' })
    expect(t).toContain('Linha 12')
    expect(t).toContain('Texto')
  })

  test('cep curto explica o zero a esquerda', () => {
    const t = textoDaRecusa({ tipo: 'campo', linha: 40, motivo: 'cep_curto', valor: '1310100' })
    expect(t).toContain('zero à esquerda')
  })

  test('duplicata identica diz que sao iguais', () => {
    const t = textoDaRecusa({ tipo: 'repetido', linha: 41, par: 902, cnpj: '11222333000181', divergencia: null })
    expect(t).toContain('902')
    expect(t).toContain('iguais')
  })

  test('duplicata divergente nomeia o campo', () => {
    const t = textoDaRecusa({ tipo: 'repetido', linha: 41, par: 902, cnpj: '11222333000181', divergencia: 'telefone' })
    expect(t).toContain('telefone')
  })
})

describe('textoDaFalhaDeArquivo', () => {
  test('nao utf-8 diz exatamente o que fazer no Excel', () => {
    expect(textoDaFalhaDeArquivo({ motivo: 'nao_utf8' })).toContain('CSV UTF-8')
  })

  test('cabecalho diferente mostra o que veio', () => {
    expect(textoDaFalhaDeArquivo({ motivo: 'cabecalho_diferente', encontrado: 'cnpj,nome' })).toContain('cnpj,nome')
  })

  test('excede limite mostra os dois numeros', () => {
    const t = textoDaFalhaDeArquivo({ motivo: 'excede_limite', linhas: 7000 })
    expect(t).toContain('7000')
    expect(t).toContain('5000')
  })
})
