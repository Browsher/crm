import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { Contato } from './historico'
import { LinhaDoTempo } from './linha-do-tempo'

const UM: Contato = {
  id: '11111111-1111-4111-8111-111111111111',
  tipo: 'nao_atendeu',
  nota: 'caiu na caixa postal',
  proximoPasso: null,
  proximoPassoData: null,
  criadoEm: new Date('2026-09-08T12:00:00Z'),
  autor: 'VendedorA',
}

describe('LinhaDoTempo', () => {
  test('lista vazia diz que ninguem ligou ainda, e nao fica em branco', () => {
    const saida = renderToStaticMarkup(<LinhaDoTempo contatos={[]} />)
    expect(saida).toContain('Nenhum contato registrado')
  })

  test('mostra o rotulo do tipo, a nota e o autor', () => {
    const saida = renderToStaticMarkup(<LinhaDoTempo contatos={[UM]} />)
    expect(saida).toContain('Liguei, não falei com ninguém')
    expect(saida).toContain('caiu na caixa postal')
    expect(saida).toContain('VendedorA')
  })

  test('mostra o proximo passo combinado quando ha', () => {
    const saida = renderToStaticMarkup(
      <LinhaDoTempo contatos={[{ ...UM, proximoPasso: 'Mandar orçamento', proximoPassoData: '2026-10-01' }]} />,
    )
    expect(saida).toContain('Mandar orçamento')
    expect(saida).toContain('2026-10-01')
  })

  // Tipo fora da lista pode existir no banco: o CHECK só exige não-vazio.
  // A tela não pode quebrar por causa disso.
  test('tipo desconhecido cai no proprio texto, sem quebrar', () => {
    const saida = renderToStaticMarkup(<LinhaDoTempo contatos={[{ ...UM, tipo: 'inventado' }]} />)
    expect(saida).toContain('inventado')
  })

  test('contato sem autor nao quebra o render', () => {
    const saida = renderToStaticMarkup(<LinhaDoTempo contatos={[{ ...UM, autor: null }]} />)
    expect(saida).toContain('caiu na caixa postal')
  })
})
