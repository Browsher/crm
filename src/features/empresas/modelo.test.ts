import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { montarModelo } from './modelo'
import { CABECALHO } from './planilha'

describe('modelo de importação', () => {
  const versionado = readFileSync('public/modelo-empresas.xlsx')

  test('existe e é um zip, que é o que um xlsx é', () => {
    expect(versionado.subarray(0, 2).toString('latin1')).toBe('PK')
  })

  // A catraca de verdade. O gerador é determinístico (sem compressão, data
  // fixa), então o binário versionado tem que ser byte a byte o que este código
  // produz. Isso pega as duas formas de o modelo apodrecer: alguém muda o
  // CABECALHO e esquece de regerar, ou alguém edita o .xlsx à mão.
  test('o arquivo versionado é o que o gerador produz hoje', () => {
    expect(montarModelo().equals(versionado)).toBe(true)
  })

  test('o cabeçalho do modelo é o CABECALHO da fase 1', () => {
    const sheet = montarModelo().toString('latin1')
    for (const coluna of CABECALHO.split(',')) {
      expect(sheet).toContain(`<t>${coluna}</t>`)
    }
  })

  // O EXEMPLO existe para o gestor VER que zero à esquerda sobrevive. Se ele
  // for trocado por um CEP sem zero, o modelo perde a demonstração e ninguém
  // percebe até alguém importar com o CEP comido.
  test('o exemplo tem CEP com zero à esquerda', () => {
    expect(montarModelo().toString('latin1')).toContain('<t>01310100</t>')
  })

  test('a oitava coluna contém o cabeçalho e um exemplo de CNAE', () => {
    const sheet = montarModelo().toString('latin1')
    expect(sheet).toContain('<c r="H1" s="2" t="inlineStr"><is><t>cnae_principal</t>')
    expect(sheet).toContain('<c r="H2" s="1" t="inlineStr"><is><t>4742300</t>')
    expect(sheet).toContain('<dimension ref="A1:H2"/>')
  })

  test('todas as oito colunas são Texto, inclusive nas linhas ainda vazias', () => {
    const sheet = montarModelo().toString('latin1')
    expect(sheet).toContain('<col min="1" max="8" width="22" style="1" customWidth="1"/>')
    expect(sheet).toContain('<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>')
  })
})

// O LIMITE DECLARADO: nada aqui prova que o EXCEL renderiza as colunas como
// Texto. Os testes provam que o XML pede isso; que o Excel obedece é
// verificação manual, registrada em docs/db/divida-tecnica.md. É a mesma classe
// de limite honesto da lista POLITICAS_DE_LEITURA_IRRESTRITA e do leitor de CSV.
