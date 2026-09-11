import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

// useActionState devolve [estado, ação, pendente]. Cada teste fixa o estado
// que quer renderizar: é o que permite exercitar os três ramos por
// renderToStaticMarkup, sem jsdom e sem clicar em nada. Foi o bug do estado
// inicial de /empresas/importar que estabeleceu este padrão.
const estado = vi.hoisted(() => ({ atual: { erro: null as string | null, filaVazia: false } }))
vi.mock('react', async () => {
  const react = await vi.importActual<typeof import('react')>('react')
  return { ...react, useActionState: () => [estado.atual, () => {}, false] }
})
vi.mock('./acoes', () => ({ agirNaFilaAcao: () => {} }))
vi.mock('./localizar/registrar-visita', () => ({ RegistrarVisita: ({ empresaId }: { empresaId: string }) => <span data-visita={empresaId} /> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
const memoria = vi.hoisted(() => ({ entradas: {} as Record<string, unknown> }))
vi.mock('./rascunhos', () => ({ useRascunhos: () => ({ entradas: memoria.entradas, gravando: false, setGravando: () => {}, marcarExpirada: () => {} }) }))

const { Formulario } = await import('./formulario')

describe('Formulario', () => {
  test('permite tentar novamente após perder reserva expirada mesmo sem anotações', () => {
    memoria.entradas = { expirada: { nome: 'Empresa anterior', expirada: true, valor: { tipo:'nao_liguei', nota:'', proximoPasso:'', proximoPassoData:'' } } }
    const saida = renderToStaticMarkup(<Formulario reserva={null} contatos={[]} />)
    memoria.entradas = {}
    expect(saida).toContain('Tentar reservar novamente')
    expect(saida).toContain('Empresa anterior')
    expect(saida).not.toContain('<article')
  })
  test('sem reserva, oferece puxar e nao fala de fila vazia', () => {
    estado.atual = { erro: null, filaVazia: false }
    const saida = renderToStaticMarkup(<Formulario reserva={null} contatos={[]} />)
    expect(saida).toContain('Puxar próxima')
    expect(saida).not.toContain('trabalhadas nos últimos 30 dias')
  })

  test('fila vazia diz POR QUE, e nao usa a palavra quarentena', () => {
    estado.atual = { erro: null, filaVazia: true }
    const saida = renderToStaticMarkup(<Formulario reserva={null} contatos={[]} />)
    expect(saida).toContain('estão com alguém')
    expect(saida).toContain('últimos 30 dias')
    expect(saida.toLowerCase()).not.toContain('quarentena')
  })

  test('erro aparece na tela', () => {
    estado.atual = { erro: 'O tempo da reserva acabou.', filaVazia: false }
    const saida = renderToStaticMarkup(<Formulario reserva={null} contatos={[]} />)
    expect(saida).toContain('O tempo da reserva acabou.')
  })

  test('reserva mostra próxima sem form aninhado e mantém contexto', () => {
    estado.atual = { erro:null, filaVazia:false }
    const saida = renderToStaticMarkup(<Formulario contexto="versao" reserva={{
      id:'e1',cnpj:'11222333000181',razaoSocial:'Cliente',nomeFantasia:null,contatoNome:null,
      telefone:'11987654321',email:null,cep:null,endereco:null,reservadoAte:new Date('2099-01-01'),
      posse:false,proximoPasso:null,proximoPassoData:null,vencido:false,
    }} contatos={[]} />)
    expect(saida).toContain('Próxima')
    expect(saida).toContain('data-visita="e1"')
    expect(saida).toContain('name="contexto" value="versao"')
    expect(saida).not.toMatch(/<form[^>]*>(?:(?!<\/form>)[\s\S])*<form/)
  })
})
