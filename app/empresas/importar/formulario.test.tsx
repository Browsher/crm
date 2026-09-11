import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { FormularioImportar } from './formulario'

// O bug que trouxe este arquivo: a tela abria no terceiro estado ("empresas
// importadas", sem número) antes de qualquer importação. Não havia teste de
// render no projeto, e foi justamente a parte sem cobertura que quebrou.
//
// renderToStaticMarkup em vez de jsdom + testing-library: useActionState
// renderiza no servidor com o estado inicial, que é exatamente o que está sob
// suspeita. Zero dependência nova.
//
// O LIMITE, declarado: isto renderiza uma vez, com o estado inicial. Não
// clica, não envia formulário, não exercita a action. Prova o primeiro render
// e nada além dele.
const html = () => renderToStaticMarkup(<FormularioImportar />)

describe('FormularioImportar: o primeiro render', () => {
  test('explica o CNAE opcional e a compatibilidade do modelo antigo', () => {
    expect(html()).toContain('CNAE principal é opcional')
    expect(html()).toContain('sete colunas continua válido')
    expect(html()).toContain('oitava coluna')
  })

  test('orienta exportar CSV UTF-8 preservando zeros à esquerda', () => {
    expect(html()).toContain('CSV UTF-8')
    expect(html()).toContain('Texto')
    expect(html()).toContain('zeros à esquerda')
  })

  test('mostra o campo de arquivo', () => {
    expect(html()).toContain('type="file"')
  })

  test('mostra o botão de conferir', () => {
    expect(html()).toContain('Conferir')
  })

  test('NÃO mostra o estado de gravado', () => {
    expect(html()).not.toContain('importada')
    expect(html()).not.toContain('Importar outro arquivo')
  })

  test('não mostra o botão de confirmar antes de haver relatório', () => {
    expect(html()).not.toContain('name="confirmar"')
  })
})
