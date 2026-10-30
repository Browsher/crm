// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/src/components/crm/tema', () => ({ useTemaCrm: () => 'light' }))
const acao = vi.hoisted(() => ({ executar: (async () => ({ erro: null, ok: false })) as (...args: unknown[]) => Promise<{ erro: string | null; ok: boolean }> }))
vi.mock('@/src/features/contato/acao', () => ({ registrarContatoAcao: (anterior: unknown, form: unknown) => acao.executar(anterior, form), prepararContatoAcao: async () => ({ok:true,fase:'negociacao',empresa:{versao:2,situacao:'primeiro_contato'}}) }))

const { Ficha } = await import('./ficha')

const EMPRESA: EmpresaComigo = {
  id:'a',cnpj:'11222333000181',razaoSocial:'Aurora',nomeFantasia:null,cnaePrincipal:null,
  ultimoContato:null,contatoNome:null,telefone:'11999999999',email:null,cep:null,endereco:null,
  situacao: 'atendimento', versao: 1, reservadoAte:null,posse:true,proximoPasso:null,proximoPassoData:null,situacaoRetorno:'sem_data',vencido:false,
}

let raiz: ReturnType<typeof createRoot> | null = null
let host: HTMLDivElement | null = null
afterEach(async () => {
  if (raiz) await act(async () => raiz?.unmount())
  host?.remove()
  raiz = null
  host = null
  sessionStorage.clear()
})

async function montar(empresa = EMPRESA) {
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
  await act(async () => raiz?.render(<Ficha empresa={empresa} contatos={[]} voltarPara="/carteira?nome=Aurora" />))
  return host
}

describe('Ficha no navegador', () => {
  test('arquivada confirma somente o envio desconhecido da aba, sem abrir novo registro', async () => {
    const valor={tipo:'nao_liguei',nota:'Sem resposta',proximoPasso:'Retornar',proximoPassoData:'2030-10-01'}
    const salvo=JSON.stringify({valor,envio:{chave:'original',versao:2,valor}})
    sessionStorage.setItem('crm:contato:v1:a',salvo)
    const tela=await montar({...EMPRESA,situacao:'sem_interesse'})
    expect([...tela.querySelectorAll('button')].find(b=>b.textContent==='Confirmar envio anterior')?.disabled).toBe(false)
    expect([...tela.querySelectorAll('button')].find(b=>b.textContent==='Registrar atendimento')?.disabled).toBe(true)
    expect(sessionStorage.getItem('crm:contato:v1:a')).toBe(salvo)
    expect(tela.querySelector<HTMLTextAreaElement>('textarea')?.readOnly).toBe(true)
  })
  test('descarte externo preserva comando desconhecido e permite fechar mantendo trabalho', async () => {
    vi.spyOn(history,'back').mockImplementation(()=>{})
    const valor={tipo:'acompanhamento',nota:'Sem resposta',proximoPasso:'Retornar',proximoPassoData:'2030-10-01'}
    const salvo=JSON.stringify({valor,envio:{chave:'original',versao:2,valor}})
    sessionStorage.setItem('crm:contato:v1:a',salvo)
    const tela=await montar()
    const clicar=async(nome:string)=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent===nome)!.click())
    await clicar('Registrar atendimento');await clicar('Cancelar atendimento');await clicar('Descartar e continuar')
    expect(document.body.textContent).toContain('Confirme o envio anterior')
    expect(sessionStorage.getItem('crm:contato:v1:a')).toBe(salvo)
    await clicar('Fechar mantendo rascunho')
    expect(tela.querySelector('form')).toBeNull()
    expect(sessionStorage.getItem('crm:contato:v1:a')).toBe(salvo)
    vi.restoreAllMocks()
  })
  test('abre o editor real e move o foco para a nota', async () => {
    const tela = await montar()
    await act(async () => [...tela.querySelectorAll('button')].find(b => b.textContent === 'Registrar atendimento')?.click())
    expect(tela.querySelector('form[data-visual="fila"]')).not.toBeNull()
    expect(tela.querySelector('textarea')).toBe(document.activeElement)
    expect(tela.querySelector('[name=desfecho]')).toBeNull()
  })

  test('cancelar descarte preserva rascunho e empresa selecionada', async () => {
    const tela = await montar()
    await act(async () => [...tela.querySelectorAll('button')].find(b => b.textContent === 'Registrar atendimento')?.click())
    const nota = tela.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(nota, 'Não perder')
      nota.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const evento = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(true)
    await act(async () => [...tela.querySelectorAll('button')].find(b => b.textContent === 'Cancelar atendimento')?.click())
    expect(document.body.textContent).toContain('Descartar as alterações?')
    await act(async () => [...document.body.querySelectorAll('button')].find(b => b.textContent === 'Cancelar')?.click())
    expect(tela.querySelector('textarea')?.value).toBe('Não perder')
    const historico = [...tela.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b => b.textContent === 'Histórico')
    expect(historico).toBeTruthy()
    await act(async () => historico!.click())
    expect(tela.querySelector('textarea')).toBe(nota)
    expect(nota.value).toBe('Não perder')
    expect(new FormData(tela.querySelector<HTMLFormElement>('form[data-visual="fila"]')!).get('id')).toBe(EMPRESA.id)
    expect(new FormData(tela.querySelector<HTMLFormElement>('form[data-visual="fila"]')!).get('tipo')).toBe('nao_liguei')
    expect(tela.querySelector('[name=posse]')).toBeNull()
  })

  test('voltar do navegador pede confirmação quando existe rascunho', async () => {
    const tela = await montar()
    await act(async () => [...tela.querySelectorAll('button')].find(b => b.textContent === 'Registrar atendimento')?.click())
    const nota = tela.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(nota, 'Rascunho')
      nota.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')))
    expect(document.body.textContent).toContain('Descartar as alterações?')
    expect(tela.querySelector('textarea')?.value).toBe('Rascunho')
  })

  test('voltar durante envio mantém o editor e não abre descarte', async () => {
    let concluir!: (estado: { erro: string | null; ok: boolean }) => void
    acao.executar = () => new Promise<{ erro: string | null; ok: boolean }>(resolve => { concluir = resolve })
    const tela = await montar()
    await act(async () => [...tela.querySelectorAll('button')].find(b => b.textContent === 'Registrar atendimento')?.click())
    const preencher = async (campo: HTMLInputElement | HTMLTextAreaElement, valor: string) => act(async () => {
      const prototipo = campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototipo, 'value')!.set!.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await preencher(tela.querySelector('textarea')!, 'Em gravação')
    await preencher(tela.querySelector<HTMLInputElement>('input[name="proximoPasso"]')!, 'Retornar')
    await preencher(tela.querySelector<HTMLInputElement>('input[name="proximoPassoData"]')!, '2030-10-01')
    await act(async () => [...tela.querySelectorAll('button')].find(b => b.textContent === 'Registrar')?.click())
    for (let tentativa = 0; tentativa < 5 && ![...tela.querySelectorAll('button')].some(b => b.textContent === 'Registrando…'); tentativa++) {
      await act(async () => new Promise(resolve => setTimeout(resolve, 0)))
    }
    expect([...tela.querySelectorAll('button')].find(b => b.textContent === 'Registrando…')?.disabled).toBe(true)
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(tela.querySelector('textarea')?.value).toBe('Em gravação')
    await act(async () => concluir({ erro: 'Falha temporária', ok: false }))
    acao.executar = async () => ({ erro: null, ok: false })
  })
})


test('histórico vazio informa título e explicação sem criar uma operação', async () => {
  const tela = await montar()
  await act(async () => [...tela.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b => b.textContent === 'Histórico')!.click())
  const painel = tela.querySelector('[role=tabpanel]:not([hidden])')!
  expect(painel.querySelector('h3')?.textContent).toBe('Ainda não há uma atividade registrada.')
  expect(painel.textContent).toContain('Os atendimentos registrados nesta empresa aparecerão aqui.')
  expect(painel.querySelector('a, button')).toBeNull()
})
