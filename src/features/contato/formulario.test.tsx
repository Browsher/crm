import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

// useActionState trocado por mock: o que se prova é qual ramo renderiza para
// cada estado, não que o estado chegue. Mesmo limite dos outros testes de
// render deste projeto — não clica, não envia formulário, não exercita a
// action.
vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: () => [{ erro: null, ok: false }, () => {}, false] }
})

const { FormularioContato } = await import('./formulario')

describe('FormularioContato', () => {
  test('sem posse, NAO pede proximo passo obrigatorio', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false} />)
    expect(saida).toContain('Combinado (opcional)')
  })

  test('com posse, PEDE proximo passo e data', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse />)
    expect(saida).toContain('Próximo passo')
    expect(saida).toContain('name="proximoPassoData"')
  })

  test('sem posse oferece os cinco tipos de reserva, e nao o de posse', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false} />)
    expect(saida).toContain('value="nao_liguei"')
    expect(saida).toContain('value="interessado"')
    expect(saida).not.toContain('value="acompanhamento"')
  })

  test('com posse oferece acompanhamento e nenhum tipo de reserva', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse />)
    expect(saida).toContain('value="acompanhamento"')
    expect(saida).not.toContain('value="nao_liguei"')
  })

  // A promessa que o sistema NÃO cumpre. Sem esta frase o vendedor acredita
  // que agendou alguma coisa.
  test('avisa que a data de retornar_depois nao agenda nada', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false} />)
    expect(saida).toContain('volta para a fila em 30 dias')
  })

  test('leva o id da empresa e a posse como campos ocultos', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse />)
    expect(saida).toContain('value="e1"')
    expect(saida).toContain('name="posse"')
  })

  test('com comDevolver, oferece o segundo botao de desfecho', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse comDevolver />)
    expect(saida).toContain('value="devolver"')
  })

  test('sem comDevolver, o desfecho e o sugerido pelo tipo, em campo oculto', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse />)
    expect(saida).toContain('name="desfecho"')
    expect(saida).toContain('value="nenhum"')
  })
})
