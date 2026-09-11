// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
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
const memoria = vi.hoisted(() => ({ entradas: {} as Record<string, unknown>, gravando: false }))
vi.mock('./rascunhos', () => ({ useRascunhos: () => ({ entradas: memoria.entradas, gravando: memoria.gravando, setGravando: () => {}, marcarExpirada: () => {} }) }))
vi.mock('./tema', () => ({ useTemaFila: () => 'dark' }))
vi.mock('./etapas', () => ({ EtapasFila: ({ etapa, bloqueado }: { etapa: string, bloqueado?: boolean }) => <div data-etapa={etapa} data-bloqueado={bloqueado || undefined} /> }))

const { Formulario } = await import('./formulario')

describe('Formulario', () => {
  test('uma reserva nova começa em consultar sem renderizar o formulario de registro', () => {
    const saida = renderToStaticMarkup(<Formulario reserva={{
      id:'e1',cnpj:'11222333000181',razaoSocial:'Cliente',nomeFantasia:null,contatoNome:null,
      telefone:'11987654321',email:null,cep:null,endereco:null,reservadoAte:new Date('2099-01-01'),
      posse:false,proximoPasso:null,proximoPassoData:null,vencido:false,
    }} contatos={[]} />)
    expect(saida).toContain('data-etapa="consultar"')
    expect(saida).toContain('Registrar resultado')
    expect(saida).not.toContain('O que aconteceu na ligação')
  })

  test('gravação de contato bloqueia voltar pela etapa sem bloquear o envio por si mesma', () => {
    memoria.gravando = true
    const saida = renderToStaticMarkup(<Formulario reserva={{
      id:'e1',cnpj:'11222333000181',razaoSocial:'Cliente',nomeFantasia:null,contatoNome:null,
      telefone:'11987654321',email:null,cep:null,endereco:null,reservadoAte:new Date('2099-01-01'),
      posse:false,proximoPasso:null,proximoPassoData:null,vencido:false,
    }} contatos={[]} />)
    memoria.gravando = false
    expect(saida).toContain('data-bloqueado="true"')
  })

  test('voltar para uma empresa anterior reinicia em consultar', async () => {
    const empresa = (id: string) => ({
      id,cnpj:'11222333000181',razaoSocial:`Cliente ${id}`,nomeFantasia:null,contatoNome:null,
      telefone:'11987654321',email:null,cep:null,endereco:null,reservadoAte:new Date('2099-01-01'),
      posse:false,proximoPasso:null,proximoPassoData:null,vencido:false,
    })
    const host = document.createElement('div')
    const root = createRoot(host)
    await act(async () => root.render(<Formulario reserva={empresa('a')} contatos={[]} />))
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Registrar resultado')!.click())
    expect(host.querySelector('[data-etapa]')?.getAttribute('data-etapa')).toBe('registrar')
    await act(async () => root.render(<Formulario reserva={empresa('b')} contatos={[]} />))
    await act(async () => root.render(<Formulario reserva={empresa('a')} contatos={[]} />))
    expect(host.querySelector('[data-etapa]')?.getAttribute('data-etapa')).toBe('consultar')
    await act(async () => root.unmount())
  })

  test('troca com anotacoes usa dialogo tematico e cancelar preserva a tela', async () => {
    memoria.entradas = { e1: { nome: 'Cliente', valor: { tipo:'nao_liguei', nota:'Minha nota', proximoPasso:'', proximoPassoData:'' } } }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<Formulario reserva={{
      id:'e1',cnpj:'11222333000181',razaoSocial:'Cliente',nomeFantasia:null,contatoNome:null,
      telefone:'11987654321',email:null,cep:null,endereco:null,reservadoAte:new Date('2099-01-01'),
      posse:false,proximoPasso:null,proximoPassoData:null,vencido:false,
    }} contatos={[]} />))
    await act(async () => host.querySelector<HTMLButtonElement>('button[value="puxar"]')!.click())
    expect(document.body.textContent).toContain('Trocar de empresa e descartar as anotações?')
    const cancelar = [...document.body.querySelectorAll('button')].find(botao => botao.textContent === 'Cancelar') as HTMLButtonElement
    await act(async () => cancelar.click())
    expect(host.textContent).toContain('Cliente')
    expect(host.textContent).toContain('Próxima')
    await act(async () => root.unmount())
    host.remove()
    memoria.entradas = {}
  })

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
