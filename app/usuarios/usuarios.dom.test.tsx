// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import PaginaUsuarios from './page'
import { criarUsuarioAcao, agirNaLinhaAcao } from './acoes'
import type { Usuario } from '@/src/features/usuarios/regras'
const lista: Usuario[] = [
  { id:'ana',nome:'Ana',email:'ana@teste.local',papel:'gestor',ativo:true,senhaProvisoriaPendente:false },
  { id:'bruno',nome:'Bruno',email:'bruno@teste.local',papel:'vendedor',ativo:true,senhaProvisoriaPendente:true },
  { id:'carla',nome:'Carla',email:'carla@teste.local',papel:'vendedor',ativo:false,senhaProvisoriaPendente:false },
]
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: vi.fn(async () => ({usuarioId:'ana',nome:'Ana',papel:'gestor'})) }))
vi.mock('@/src/features/usuarios/repositorio', () => ({ repositorioPostgres: () => ({listar:async () => lista}) }))
vi.mock('./acoes', () => ({criarUsuarioAcao:vi.fn(),agirNaLinhaAcao:vi.fn()}))
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => { if(root) await act(async () => root.unmount()); host?.remove(); vi.resetAllMocks() })
async function montar() { host=document.createElement('div');document.body.append(host);root=createRoot(host);const page=await PaginaUsuarios();await act(async () => root.render(page)) }
function botao(nome:string, base:ParentNode=document) { const b=[...base.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===nome);expect(b,`botão ${nome}`).toBeTruthy();return b! }
async function clicar(nome:string,base:ParentNode=document) { await act(async()=>botao(nome,base).click());await act(async()=>{await new Promise(r=>setTimeout(r,0))}) }
async function preencher(nome:string,valor:string) { const e=document.querySelector<HTMLInputElement>(`input[name=${nome}]`)!;expect(e).toBeTruthy();await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(e,valor);e.dispatchEvent(new Event('input',{bubbles:true}))});return e }
async function selecionar(nome:string,valor:string) { const e=document.querySelector<HTMLSelectElement>(`select[name=${nome}]`)!;expect(e).toBeTruthy();await act(async()=>{e.value=valor;e.dispatchEvent(new Event('change',{bubbles:true}))}) }
function linha(nome:string) { const r=[...document.querySelectorAll('tbody tr')].find(r=>r.textContent?.includes(nome));expect(r).toBeTruthy();return r! }
async function enviar() { const f=document.querySelector<HTMLFormElement>('[role=dialog] form')!;expect(f).toBeTruthy();await act(async()=>{f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}) }

test('lista combina busca e filtros, limpa resultado vazio e não oferece ações próprias',async()=>{
  await montar();expect(document.querySelectorAll('tbody tr')).toHaveLength(3)
  expect(linha('Ana').textContent).toContain('Você');expect(linha('Ana').querySelector('button')).toBeNull()
  await preencher('busca',' BRUNO@');expect(document.querySelectorAll('tbody tr')).toHaveLength(1);expect(linha('Bruno')).toBeTruthy()
  await selecionar('situacao','inativos');expect(document.querySelectorAll('tbody tr')).toHaveLength(0);expect(document.body.textContent).toContain('Nenhum usuário encontrado')
  await clicar('Limpar filtros');await selecionar('papelFiltro','gestor');expect(document.querySelectorAll('tbody tr')).toHaveLength(1);expect(linha('Ana')).toBeTruthy()
})
test('criação preserva campos no erro, mostra senha, copia e descarta ao fechar',async()=>{
  await montar();await clicar('Novo usuário');await preencher('nome','Daniel');await preencher('email','daniel@teste.local')
  expect(document.querySelector<HTMLInputElement>('input[value=vendedor]')?.checked).toBe(true)
  vi.mocked(criarUsuarioAcao).mockResolvedValueOnce({erro:'E-mail em uso.',criado:null}).mockResolvedValueOnce({erro:null,criado:{nome:'Daniel',senhaProvisoria:'Segredo-temporario'}})
  await enviar();expect(document.querySelector('[role=alert]')?.textContent).toContain('E-mail em uso');expect(document.querySelector<HTMLInputElement>('input[name=nome]')?.value).toBe('Daniel')
  const copiar=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{value:{writeText:copiar},configurable:true})
  await enviar();expect(document.querySelector('[role=dialog] code')?.textContent).toBe('Segredo-temporario')
  await clicar('Copiar senha');expect(copiar).toHaveBeenCalledWith('Segredo-temporario');expect(document.querySelector('[role=status]')?.textContent).toContain('copiada')
  await clicar('Concluir');expect(document.body.textContent).not.toContain('Segredo-temporario');await clicar('Novo usuário');expect(document.querySelector('code')).toBeNull()
})
test('cancelamento não envia ação, confirmação envia alvo e novo papel, erro permite nova tentativa',async()=>{
  await montar();await clicar('Tornar gestor',linha('Bruno'));expect(document.querySelector('[role=dialog]')?.textContent).toContain('Bruno')
  await clicar('Cancelar');expect(agirNaLinhaAcao).not.toHaveBeenCalled()
  await clicar('Tornar gestor',linha('Bruno'));vi.mocked(agirNaLinhaAcao).mockResolvedValueOnce({erro:'Sem permissão.',senhaProvisoria:null}).mockResolvedValueOnce({erro:null,senhaProvisoria:null})
  await enviar();expect(document.querySelector('[role=alert]')?.textContent).toContain('Sem permissão');const form=vi.mocked(agirNaLinhaAcao).mock.calls[0][1];expect([form.get('id'),form.get('acao'),form.get('papel')]).toEqual(['bruno','mudar_papel','gestor'])
  await enviar();expect(document.querySelector('[role=dialog]')).toBeNull()
})
test('pendência bloqueia botões e Escape; nova senha aguarda confirmação e falha de cópia orienta cópia manual',async()=>{
  await montar();await clicar('Nova senha provisória',linha('Bruno'));expect(agirNaLinhaAcao).not.toHaveBeenCalled()
  let resolver!: (r:{erro:null;senhaProvisoria:string})=>void
  vi.mocked(agirNaLinhaAcao).mockReturnValue(new Promise(r=>{resolver=r}))
  await enviar();expect(botao('Confirmando…').disabled).toBe(true);expect(botao('Cancelar').disabled).toBe(true)
  await act(async()=>document.querySelector('[role=dialog]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(document.querySelector('[role=dialog]')).not.toBeNull()
  await act(async()=>resolver({erro:null,senhaProvisoria:'Nova-secreta'}));expect(document.querySelector('code')?.textContent).toBe('Nova-secreta')
  Object.defineProperty(navigator,'clipboard',{value:{writeText:vi.fn().mockRejectedValue(new Error('negado'))},configurable:true})
  await clicar('Copiar senha');expect(document.querySelector('[role=status]')?.textContent).toContain('manualmente');expect(document.querySelector('code')?.textContent).toBe('Nova-secreta')
})
