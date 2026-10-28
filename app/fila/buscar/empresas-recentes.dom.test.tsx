// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { EmpresaBancoRecente } from '@/src/lib/empresas-banco-recentes'
const m=vi.hoisted(()=>({carregar:vi.fn()}))
vi.mock('@/app/empresas/busca/detalhe-acao',()=>({lerEmpresaBuscaAcao:m.carregar}))
import { EmpresasBancoRecentes } from './empresas-recentes'

let root: ReturnType<typeof createRoot>, host: HTMLDivElement
let redimensionar: ResizeObserverCallback
vi.stubGlobal('ResizeObserver', class { constructor(cb: ResizeObserverCallback) { redimensionar = cb } observe() {} disconnect() {} })
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove() })
const nome = 'Armarinhos e variedades com um nome bastante extenso para o vendedor'
const grupo = 'Armarinhos · Brás · Grupo de origem com identificação completa'
const empresas: EmpresaBancoRecente[] = Array.from({length:14},(_,i)=>({id:String(i),buscaId:'busca',empresaId:i===0?'empresa-importada':null,atividade:'Armarinhos',endereco:'Rua fictícia, Brás, São Paulo/SP',comTelefone:true,comEmail:false,nome:i===0?nome:`Empresa ${i}`,grupoOrigem:grupo,cnpj:'99887766000105',cnae:'4755502',cep:null,porte:'ME',abertura:'2012-01-01',bairro:'Brás',cidade:'São Paulo',uf:'SP',origens:['banco'],nichos:['Armarinhos'],regioes:[],entrada:'2026-10-27T01:00:00Z',situacao:i===0?'cliente':'atendimento'}))
beforeEach(()=>{m.carregar.mockReset().mockResolvedValue({ok:true,conteudo:<p>Dados completos da empresa</p>})})
async function montar(dados=empresas) {
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<EmpresasBancoRecentes empresas={dados}/>))
}
const botao=(nome:string)=>host.querySelector<HTMLButtonElement>(`[aria-label="${nome}"]`)!
const cards=()=>host.querySelectorAll('[data-empresa-recente]')
const clicar=async(nome:string)=>act(async()=>botao(nome).click())
async function largura(width:number) { await act(async()=>redimensionar([{contentRect:{width}}] as ResizeObserverEntry[],{} as ResizeObserver)) }

test('três por vez, 11 únicas e último card com destino filtrado, sem rotação automática',async()=>{
 await montar()
 expect(host.querySelector('h2')?.textContent).toBe('Últimas buscas')
 expect(cards()).toHaveLength(3)
 expect(botao('Empresas anteriores').disabled).toBe(true)
 const vistos=[...cards()].map(c=>c.getAttribute('data-empresa-recente'))
 for(let i=0;i<3;i++){await clicar('Próximas empresas');vistos.push(...[...cards()].map(c=>c.getAttribute('data-empresa-recente')))}
 expect(vistos).toEqual(Array.from({length:11},(_,i)=>String(i)))
 expect(botao('Próximas empresas').disabled).toBe(true)
 expect([...host.querySelectorAll('a')].find(a=>a.textContent==='Ver todas buscas')?.getAttribute('href')).toBe('/fila/localizar?origem=banco')
})
test('nome e grupo limitados visualmente, Cliente apenas e detalhes completos com data de São Paulo',async()=>{
 await montar()
 const card=cards()[0]
 expect(Array.from(card.querySelector('h3')!.textContent!)).toHaveLength(36)
 expect(Array.from(card.querySelector('[data-grupo-origem]')!.textContent!)).toHaveLength(40)
 expect(card.textContent).toContain('26/10/2026')
 expect(host.textContent).not.toContain('Em atendimento')
 expect(host.querySelectorAll('[data-slot="badge"]')).toHaveLength(1)
 expect(card.textContent).not.toContain('99887766000105')
 await act(async()=>card.querySelector<HTMLButtonElement>('button')!.click())
 const d=document.querySelector('[role="dialog"]')!
 expect(d.textContent).toContain(nome);expect(d.textContent).toContain(grupo)
 expect(d.textContent).toContain('Dados completos da empresa')
 expect(m.carregar).toHaveBeenCalledWith('busca','99887766000105')
 expect(d.querySelector('a')?.getAttribute('href')).toContain('pessoal=')
 await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Fechar"]')!.click())
 expect(document.querySelector('[role="dialog"]')).toBeNull()
})
test('resize na última página mantém atalho acessível e só um card no celular',async()=>{
 await montar()
 for(let i=0;i<3;i++)await clicar('Próximas empresas')
 await largura(390)
 expect(cards()).toHaveLength(1)
 for(let i=0;i<2;i++)await clicar('Próximas empresas')
 expect(cards()).toHaveLength(0)
 expect(host.textContent).toContain('Ver todas buscas')
 await largura(736)
 expect(cards()).toHaveLength(2)
 expect(host.textContent).toContain('Ver todas buscas')
})
test('teclado navega nos controles e não interfere no pop-up',async()=>{
 await montar()
 const controle=host.querySelector('[role="group"]')!
 await act(async()=>controle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})))
 expect(cards()[0].getAttribute('data-empresa-recente')).toBe('3')
 await act(async()=>cards()[0].querySelector<HTMLButtonElement>('button')!.click())
 await act(async()=>document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})))
 expect(cards()[0].getAttribute('data-empresa-recente')).toBe('3')
})
test('vazio e poucos registros não geram cartões fictícios; atualização não perde o atalho',async()=>{
 await montar([])
 expect(cards()).toHaveLength(0)
 expect(host.textContent).toContain('As empresas encontradas nas suas buscas aparecerão aqui.')
 expect(host.textContent).toContain('Ver todas buscas')
 await act(async()=>root.render(<EmpresasBancoRecentes empresas={empresas.slice(0,1)}/>))
 expect(cards()).toHaveLength(1)
 expect(botao('Próximas empresas').disabled).toBe(true)
})

test('fechar após resize devolve foco à região se o botão de origem saiu da página',async()=>{
 await montar()
 await act(async()=>cards()[2].querySelector<HTMLButtonElement>('button')!.click())
 await largura(390)
 await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Fechar"]')!.click())
 await vi.waitFor(()=>expect(document.activeElement).toBe(host.querySelector('section')))
})

test('desktop amplia textos e informações úteis; celular volta ao resumo',async()=>{
 await montar();await largura(1300)
 expect(cards()[0].querySelector('h3')?.textContent).toBe(nome)
 expect(cards()[0].querySelector('[data-grupo-origem]')?.textContent).toBe(grupo)
 expect(cards()[0].querySelector('[data-desktop-dados]')?.textContent).toContain('Telefone')
 expect(cards()[0].textContent).not.toContain('119')
 await largura(390)
 expect(Array.from(cards()[0].querySelector('h3')!.textContent!)).toHaveLength(36)
})
test('fecha pedido anterior sem trocar conteúdo, permite tentar novamente sem nova busca',async()=>{
 let concluir!:(r:{ok:true;conteudo:string})=>void
 m.carregar.mockImplementationOnce(()=>new Promise(r=>{concluir=r})).mockResolvedValueOnce({ok:false,erro:'Leitura temporariamente indisponível'}).mockResolvedValueOnce({ok:true,conteudo:'Dados atuais'})
 await montar();await act(async()=>cards()[0].querySelector<HTMLButtonElement>('button')!.click())
 expect(document.querySelector('[role="status"]')?.textContent).toBe('Carregando empresa…')
 await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Fechar"]')!.click())
 await act(async()=>cards()[1].querySelector<HTMLButtonElement>('button')!.click())
 await act(async()=>concluir({ok:true,conteudo:'Dados atrasados'}))
 expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Dados atrasados')
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Tentar novamente')!.click())
 expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Dados atuais')
})
