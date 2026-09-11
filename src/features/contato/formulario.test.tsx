import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { EstadoContato } from './acao'

const captura = vi.hoisted(() => ({
  action: null as null | ((estado: EstadoContato, form: FormData) => Promise<EstadoContato>),
  registrar: vi.fn(),
  pendente: false,
}))
vi.mock('./acao', () => ({ registrarContatoAcao: captura.registrar }))

// useActionState trocado por mock: o que se prova é qual ramo renderiza para
// cada estado, não que o estado chegue. Mesmo limite dos outros testes de
// render deste projeto — não clica, não envia formulário, não exercita a
// action.
vi.mock('react', async () => {
  const real = await vi.importActual<typeof import('react')>('react')
  return { ...real, useActionState: (action: typeof captura.action) => {
    captura.action = action
    return [{ erro: null, ok: false }, () => {}, captura.pendente]
  } }
})

const { FormularioContato } = await import('./formulario')

describe('FormularioContato', () => {
  test('troca pendente congela rascunho sem confundir com bloqueio por expiração', () => {
    const html = renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false} somenteLeitura />)
    expect(html).toMatch(/<textarea[^>]*readOnly=""/)
    expect(html.match(/<input[^>]*readOnly=""/g)).toHaveLength(2)
    expect(html.match(/<input[^>]*type="radio"[^>]*disabled=""/g)).toHaveLength(5)
    const expirada = renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false} bloqueado />)
    expect(expirada).not.toMatch(/readOnly=""/)
  })
  test('label da nota tem texto fixo e associação única mesmo com rascunho', () => {
    const html = renderToStaticMarkup(<><FormularioContato empresaId="e1" posse={false}
      rascunho={{ tipo: 'nao_liguei', nota: 'Texto preenchido', proximoPasso: '', proximoPassoData: '' }} />
      <FormularioContato empresaId="e2" posse={false} /></>)
    const ids = [...html.matchAll(/<label for="([^"]+)"[^>]*>Nota<\/label>/g)].map(m => m[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    for (const id of ids) expect(html).toContain(`<textarea id="${id}"`)
  })
  test('enquanto grava congela os campos sem impedir copiar anotações', () => {
    captura.pendente = true
    try {
      const html = renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false} />)
      expect(html).toMatch(/<textarea[^>]*readOnly=""/)
      expect(html.match(/<input[^>]*readOnly=""/g)).toHaveLength(2)
      expect(html.match(/<input[^>]*type="radio"[^>]*disabled=""/g)).toHaveLength(5)
      expect(html).not.toMatch(/<textarea[^>]*disabled/)
    } finally { captura.pendente = false }
  })
  test('sucesso notifica empresa submetida antes de encerrar envio', async () => {
    const eventos: unknown[] = []
    captura.registrar.mockResolvedValueOnce({ erro: null, ok: true })
    renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false}
      onSaved={id => eventos.push(id)} onPendingChange={p => eventos.push(p)} />)
    await captura.action!({ erro: null, ok: false }, new FormData())
    expect(eventos).toEqual([true, 'e1', false])
  })

  test('falha preserva rascunho e sempre encerra envio', async () => {
    const salvo = vi.fn()
    const pendente = vi.fn()
    captura.registrar.mockRejectedValueOnce(new Error('infraestrutura'))
    renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false} onSaved={salvo} onPendingChange={pendente} />)
    await expect(captura.action!({ erro: null, ok: false }, new FormData())).rejects.toThrow('infraestrutura')
    expect(salvo).not.toHaveBeenCalled()
    expect(pendente.mock.calls).toEqual([[true], [false]])
  })

  test('bloqueio também recusa dispatch da action', async () => {
    captura.registrar.mockClear()
    renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false} bloqueado />)
    expect(await captura.action!({ erro: null, ok: false }, new FormData())).toMatchObject({ ok: false })
    expect(captura.registrar).not.toHaveBeenCalled()
  })
  test('rascunho bloqueado mantém campos editáveis e impede registrar', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse={false} bloqueado
      rascunho={{ tipo: 'interessado', nota: 'Minha nota', proximoPasso: 'Retornar', proximoPassoData: '2026-10-01' }} />)
    expect(saida).toContain('Minha nota')
    expect(saida).toContain('value="Retornar"')
    expect(saida).toContain('value="2026-10-01"')
    expect(saida).toMatch(/<button[^>]*disabled/)
    expect(saida).not.toMatch(/<textarea[^>]*disabled/)
  })
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

// Achado da verificação manual: o aviso dos 30 dias era fixo por `posse` e
// aparecia nos cinco tipos de reserva — inclusive em `interessado`, que ASSUME
// a empresa em vez de devolvê-la. O aviso mente ali.
//
// `tipoInicial` existe para o render alcançar os outros ramos sem DOM: sem
// clique não há como mudar o `useState`, e sem ele este teste não existiria.
describe('FormularioContato: o aviso segue o desfecho, nao a posse', () => {
  test('tipo que devolve avisa que a empresa volta em 30 dias', () => {
    const saida = renderToStaticMarkup(
      <FormularioContato empresaId="e1" posse={false} tipoInicial="nao_atendeu" />,
    )
    expect(saida).toContain('volta para a fila em 30 dias')
  })

  test('interessado NAO avisa dos 30 dias, porque assume em vez de devolver', () => {
    const saida = renderToStaticMarkup(
      <FormularioContato empresaId="e1" posse={false} tipoInicial="interessado" />,
    )
    expect(saida).not.toContain('30 dias')
  })

  test('interessado diz que a empresa vai para a sua carteira', () => {
    const saida = renderToStaticMarkup(
      <FormularioContato empresaId="e1" posse={false} tipoInicial="interessado" />,
    )
    expect(saida).toContain('carteira')
  })

  test('na ficha, o botao de devolver avisa dos 30 dias ao lado dele', () => {
    const saida = renderToStaticMarkup(<FormularioContato empresaId="e1" posse comDevolver />)
    expect(saida).toContain('30 dias')
  })
})
