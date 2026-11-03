// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Quadro } from './quadro'
import { etapaAcao, semInteresseAcao } from './acoes'
import { ETAPAS_FUNIL } from '@/src/lib/comercial'
import type { NegociacaoResumo } from '@/src/features/funil/consulta'
const replace=vi.hoisted(()=>vi.fn())
const refresh=vi.hoisted(()=>vi.fn())
vi.mock('next/navigation',()=>({useRouter:()=>({refresh,replace})}))
vi.mock('./acoes',()=>({etapaAcao:vi.fn(),semInteresseAcao:vi.fn()}))
vi.mock('./modal',()=>({ModalFunil:({fechar}:{fechar:(aviso?:string)=>void})=> <><p>Negociação operacional</p><button onClick={()=>fechar('Atendimento registrado.')}>Fechar modal de teste</button></>}))
vi.mock('@/src/components/crm/empresa-dialogo',()=>({EmpresaDialogo:()=> <p>Dados da empresa</p>}))
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
const linha=(etapa:NegociacaoResumo['etapa']='primeiro_contato'):NegociacaoResumo=>({id:'00000000-0000-4000-8000-000000000001',empresaId:'00000000-0000-4000-8000-000000000002',nome:'Aurora',cidade:null,etapa,versao:3,empresa:{referencia:{tipo:'cadastro',empresaId:'00000000-0000-4000-8000-000000000002'},id:'00000000-0000-4000-8000-000000000002',nome:'Aurora',cnpj:null,cnae:null,atividade:null,bairro:null,cidade:null,uf:null,origens:['legado'],recebidaEm:null,situacao:etapa,versao:3,negociacaoId:'00000000-0000-4000-8000-000000000001'}})
beforeEach(()=>{vi.resetAllMocks();sessionStorage.clear();vi.stubGlobal('requestAnimationFrame',(f:()=>void)=>{f();return 1});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))})
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();vi.restoreAllMocks()})
async function montar(dados=[linha()],selecionada:string|null=null,usuarioId='teste'){host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<Quadro usuarioId={usuarioId} linhas={dados} negociacaoInicial={selecionada}/>))}
async function evento(alvo:Element,tipo:string){const e=new Event(tipo,{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{setData:vi.fn(),effectAllowed:'move'}});await act(async()=>{alvo.dispatchEvent(e)})}
async function clicar(nome:string){await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===nome)!.click())}
test.each(ETAPAS_FUNIL)('ação individual arquiva %s sem alvo permanente e mantém card durante envio/falha',async etapa=>{
 let resolver!:(r:{ok:boolean;erro:string})=>void
 vi.mocked(semInteresseAcao).mockReturnValue(new Promise(r=>resolver=r))
 await montar([linha(etapa)])
 expect(ETAPAS_FUNIL).toEqual(['primeiro_contato','em_negociacao','proposta_enviada'])
 expect(host.querySelectorAll('[data-etapa]')).toHaveLength(3)
 expect(host.querySelector('[data-descarte]')).toBeNull()
 expect(host.textContent).not.toContain('ou para Sem interesse')
 expect(host.querySelector('[draggable=true]')).not.toBeNull()
 await clicar('Marcar como Sem interesse')
 expect(host.textContent).toContain('Aurora');expect(host.textContent).not.toContain('Negociação operacional')
 await clicar('Marcar como Sem interesse')
 expect(semInteresseAcao).toHaveBeenCalledTimes(1)
 await act(async()=>resolver({ok:false,erro:'Falha simulada'}))
 expect(host.querySelector('[draggable=true]')).not.toBeNull();expect(host.textContent).toContain('Falha simulada')
})

test('ver empresa mostra dados; ação comum e deep-link abrem negociação operacional',async()=>{
 await montar();await clicar('Ver empresa');expect(host.textContent).toContain('Dados da empresa');expect(host.textContent).not.toContain('Negociação operacional')
 await clicar('Abrir no funil');expect(host.textContent).toContain('Negociação operacional')
 await act(async()=>root.unmount());host.remove();await montar([linha()],linha().id);expect(host.textContent).toContain('Negociação operacional')
})
test('menu por teclado/toque e retry desconhecido preservam chave; replay não anima',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:true,repetida:true,atual:false})
 await montar();await clicar('Marcar como Sem interesse')
 expect(host.textContent).toContain('Não foi possível confirmar');expect(host.textContent).toContain('Aurora')
 const primeiro=vi.mocked(semInteresseAcao).mock.calls[0][0]
 await clicar('Confirmar envio anterior')
 expect(vi.mocked(semInteresseAcao).mock.calls[1][0].get('chave')).toBe(primeiro.get('chave'))
 expect(host.querySelector('[data-descarte]')?.getAttribute('data-estado')).not.toBe('sucesso')
 expect(host.textContent).toContain('Aurora')
})
test('origem indisponível não recebe intenção nova',async()=>{
 const l=linha();l.empresa={...l.empresa,situacao:'indisponivel',motivoIndisponibilidade:'origem_inativa'}
 await montar([l]);expect(host.querySelector('[draggable=true]')).toBeNull();expect(host.textContent).not.toContain('Marcar como Sem interesse')
})
test('avanço continua limitado à próxima etapa e restaura card após falha',async()=>{
 await montar();const card=host.querySelector('[draggable=true]')!,colunas=host.querySelectorAll('[data-etapa]')
 await evento(card,'dragstart');await evento(colunas[2],'drop');expect(etapaAcao).not.toHaveBeenCalled()
 vi.mocked(etapaAcao).mockResolvedValue({ok:false,erro:'Falhou avanço'})
 await evento(card,'dragstart');await evento(colunas[1],'drop');expect(etapaAcao).toHaveBeenCalledTimes(1);expect(colunas[0].textContent).toContain('Aurora')
})

test('resposta confirmada atual retira card e devolve foco ao status',async()=>{
 vi.mocked(semInteresseAcao).mockResolvedValue({ok:true,repetida:false,atual:true})
 await montar();await clicar('Marcar como Sem interesse')
 expect(host.querySelector('[role=status]')?.textContent).toContain('Empresa marcada como Sem interesse')
 expect(host.textContent).not.toContain('Aurora')
 expect(document.activeElement).toBe(host.querySelector('[role=status]'))
})

test('refresh recupera card e comando desconhecido mesmo ausente na consulta atual',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede'))
 await montar();await clicar('Marcar como Sem interesse')
 const chave=vi.mocked(semInteresseAcao).mock.calls[0][0].get('chave')
 await act(async()=>root.unmount());host.remove();await montar([])
 expect(host.textContent).toContain('Aurora');expect(host.textContent).toContain('Confirme o envio anterior')
 vi.mocked(semInteresseAcao).mockResolvedValue({ok:true,repetida:true,atual:true})
 await clicar('Confirmar envio anterior')
 expect(vi.mocked(semInteresseAcao).mock.calls[1][0].get('chave')).toBe(chave)
 expect(host.textContent).toContain('Envio anterior confirmado')
})

test('troca de usuário não recupera o card nem o comando privado da sessão anterior',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede'))
 await montar();await clicar('Marcar como Sem interesse')
 await act(async()=>root.unmount());host.remove();await montar([],null,'outro')
 expect(host.textContent).not.toContain('Aurora');expect(host.textContent).not.toContain('Confirmar envio anterior')
})

test.each(['sem_permissao','nao_encontrada'] as const)('recusa inconclusiva %s conserva envio após remontagem até replay',async motivo=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:false,motivo,erro:'Acesso temporariamente recusado'}).mockResolvedValueOnce({ok:true,repetida:true,atual:false})
 await montar();await clicar('Marcar como Sem interesse')
 const original=Object.fromEntries(vi.mocked(semInteresseAcao).mock.calls[0][0])
 await clicar('Confirmar envio anterior')
 expect(sessionStorage.getItem('crm:funil:arquivo:v1:teste')).not.toBeNull()
 await clicar('Ver empresa');expect(host.textContent).toContain('Dados da empresa')
 await act(async()=>root.unmount());host.remove();await montar([])
 await clicar('Confirmar envio anterior')
 expect(Object.fromEntries(vi.mocked(semInteresseAcao).mock.calls[2][0])).toEqual(original)
 expect(sessionStorage.getItem('crm:funil:arquivo:v1:teste')).toBeNull()
})

test('recusa conclusiva libera nova intenção sem manter chave antiga',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:false,motivo:'desatualizada',erro:'Mudou'})
 await montar();await clicar('Marcar como Sem interesse');await clicar('Confirmar envio anterior')
 expect(sessionStorage.getItem('crm:funil:arquivo:v1:teste')).toBeNull()
 expect(host.textContent).not.toContain('Confirmar envio anterior')
 expect(host.querySelector('[draggable=true]')).not.toBeNull()
})

test('mudança de identidade na mesma tela não carrega memória privada de envio',async()=>{
 vi.mocked(semInteresseAcao).mockRejectedValueOnce(new Error('rede'))
 await montar();await clicar('Marcar como Sem interesse')
 await act(async()=>root.render(<Quadro usuarioId="outro" linhas={[]}/>))
 expect(host.textContent).not.toContain('Aurora')
 expect(host.textContent).not.toContain('Confirmar envio anterior')
 expect(sessionStorage.getItem('crm:funil:arquivo:v1:teste')).not.toBeNull()
})

test('fechar deep-link remove somente negociação e conserva consulta/hash',async()=>{
 history.replaceState({origem:'teste'},'','/funil?negociacao='+linha().id+'&origem=google&pagina=3#negociacoes')
 await montar([linha()],linha().id)
 await clicar('Fechar modal de teste')
 expect(replace).toHaveBeenCalledWith('/funil?origem=google&pagina=3#negociacoes',{scroll:false})
 expect(history.state.origem).toBe('teste')
 expect(host.textContent).not.toContain('Negociação operacional')
 history.replaceState(null,'','/')
})

test('abertura manual sem deep-link conserva refresh após contato e não faz replace redundante',async()=>{
 history.replaceState(null,'','/funil')
 await montar();await clicar('Abrir no funil')
 expect(location.pathname+location.search).toBe('/funil')
 await clicar('Fechar modal de teste')
 expect(refresh).toHaveBeenCalledTimes(1);expect(replace).not.toHaveBeenCalled()
 expect(host.textContent).toContain('Atendimento registrado.')
 expect(host.textContent).not.toContain('Negociação operacional')
})
