import { describe, expect, test } from 'vitest'
import { textoDaFalhaDeArquivo, textoDaRecusa, textoDoEndereco } from './mensagens'

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

describe('textoDoEndereco: da a saida, nao so o diagnostico', () => {
  const base = { novas: 3, jaCadastradas: 0, recusadas: [] }

  test('base nao carregada manda rodar o carregador', () => {
    const t = textoDoEndereco({ ...base, cepsPedidos: 2, cepsNaoEncontrados: 2, basePublicadaEm: null })
    expect(t).toContain('não está carregada')
    expect(t).toContain('db:cep:carregar')
  })

  // Sem CEP nenhum no arquivo, a base nao ter sido carregada nao afeta esta
  // importacao. Avisar seria ruido numa tela que ja tem relatorio.
  test('base nao carregada e nenhum CEP no arquivo: nao diz nada', () => {
    expect(textoDoEndereco({ ...base, cepsPedidos: 0, cepsNaoEncontrados: 0, basePublicadaEm: null })).toBe(null)
  })

  test('base carregada e tudo resolvido: nao diz nada', () => {
    expect(
      textoDoEndereco({ ...base, cepsPedidos: 2, cepsNaoEncontrados: 0, basePublicadaEm: '2024-07-08' }),
    ).toBe(null)
  })

  test('base carregada com CEP nao encontrado cita a data', () => {
    const t = textoDoEndereco({ ...base, cepsPedidos: 2, cepsNaoEncontrados: 1, basePublicadaEm: '2024-07-08' })
    expect(t).toContain('2024-07-08')
    expect(t).toContain('sem endereço')
    expect(t).not.toContain('db:cep:carregar')
  })

  test('singular e plural', () => {
    const um = textoDoEndereco({ ...base, cepsPedidos: 1, cepsNaoEncontrados: 1, basePublicadaEm: '2024-07-08' })
    const dois = textoDoEndereco({ ...base, cepsPedidos: 2, cepsNaoEncontrados: 2, basePublicadaEm: '2024-07-08' })
    expect(um).toContain('1 CEP não encontrado')
    expect(dois).toContain('2 CEPs não encontrados')
  })
})


test.each([7, 8] as const)('recusa de colunas informa o formato esperado %s', (esperado) => {
  expect(textoDaRecusa({ tipo: 'campo', linha: 2, motivo: 'colunas_erradas', valor: '9', esperado })).toContain(`o modelo tem ${esperado}`)
})

test('CNAE invalido explica as duas formas aceitas', () => {
  const texto = textoDaRecusa({ tipo: 'campo', linha: 2, motivo: 'cnae_forma', valor: 'abc' })
  expect(texto).toContain('7 dígitos')
  expect(texto).toContain('4742-3/00')
})
