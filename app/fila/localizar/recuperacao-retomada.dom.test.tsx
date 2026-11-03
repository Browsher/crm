// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RecuperacaoRetomada } from './recuperacao-retomada'
import { LocalizarPessoal } from './pessoal'
import { retomarAtendimentoAcao, iniciarAtendimentoAcao } from '../atendimento/acoes'
import type { ConsultaAtendimentoPessoal } from '@/src/server/prospeccao-pessoal'
const push=vi.hoisted(()=>vi.fn())
const refresh=vi.hoisted(()=>vi.fn())
vi.mock('next/navigation',()=>({useRouter:()=>({push,refresh})}))
vi.mock('../atendimento/acoes',()=>({retomarAtendimentoAcao:vi.fn(),iniciarAtendimentoAcao:vi.fn()}))
vi.mock('@/src/components/crm/empresa-dialogo',()=>({EmpresaDialogo:()=> <p>Consulta livre</p>}))
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
const storage='crm:retomar-arquivo:v1:eu'
const comando={id:'desaparecida',versao:4,chave:'original'}
const filtros={disponibilidade:'sem_interesse',nome:'Aurora',cnpj:'12345678901234',nicho:'Luz',endereco:'Centro',pagina:'3'}
const dados:ConsultaAtendimentoPessoal={empresas:[],total:0,nichos:[],bairros:[]}
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
function tela(usuarioId='eu',comEmpresa=false){return <RecuperacaoRetomada usuarioId={usuarioId} filtros={filtros}><LocalizarPessoal filtros={filtros} recolhido={false} dados={comEmpresa?{...dados,empresas:[{id:'outra',referencia:{tipo:'cadastro',empresaId:'outra'},nome:'Outra empresa',cnpj:null,cnae:null,atividade:null,recebidaEm:null,negociacaoId:null,versao:5,situacao:'sem_interesse',origens:['banco'],bairro:null,cidade:null,uf:null,cep:null,porte:null,abertura:null,nichos:[],regioes:[],entrada:''}],total:1}:dados}/></RecuperacaoRetomada>}
async function montar(comEmpresa=false){host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(tela('eu',comEmpresa)))}
async function clicar(nome:string){const b=[...host.querySelectorAll('button')].find(b=>b.textContent===nome);expect(b).toBeDefined();await act(async()=>b!.click())}
beforeEach(()=>{vi.resetAllMocks();sessionStorage.clear()})
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();sessionStorage.clear();vi.restoreAllMocks()})
test('comando legado é recuperado fora da grade vazia e após reload, sem replay automático',async()=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar()
 expect(host.textContent).toContain('Confirmar retomada anterior');expect(retomarAtendimentoAcao).not.toHaveBeenCalled()
 expect(host.querySelector('section[aria-labelledby="minhas-empresas-titulo"]')?.textContent).not.toContain('Confirmar retomada anterior')
 await act(async()=>root.unmount());host.remove();await montar()
 expect(retomarAtendimentoAcao).not.toHaveBeenCalled()
 vi.mocked(retomarAtendimentoAcao).mockResolvedValue({ok:true,versao:5,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'desaparecida'}}})
 await clicar('Confirmar retomada anterior')
 expect(Object.fromEntries(vi.mocked(retomarAtendimentoAcao).mock.calls[0][0])).toEqual({id:comando.id,versao:'4',chave:comando.chave})
 expect(push).toHaveBeenCalledWith('/fila/atendimento/desaparecida?nicho=Luz&endereco=Centro&nome=Aurora&cnpj=12345678901234&disponibilidade=sem_interesse&pagina=3')
 expect(sessionStorage.getItem(storage)).toBeNull()
})
test.each(['rede','sem_permissao','nao_encontrada'] as const)('resultado incerto %s conserva comando e bloqueia novas retomadas; consulta segue livre',async motivo=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar(true)
 const retomar=[...host.querySelectorAll('button')].find(b=>b.textContent==='Retomar atendimento')
 expect(!retomar||retomar.disabled).toBe(true)
 await clicar('Ver empresa');expect(host.textContent).toContain('Consulta livre')
 if(motivo==='rede')vi.mocked(retomarAtendimentoAcao).mockRejectedValueOnce(new Error('rede'))
 else vi.mocked(retomarAtendimentoAcao).mockResolvedValueOnce({ok:false,motivo})
 await clicar('Confirmar retomada anterior')
 expect(sessionStorage.getItem(storage)).toBe(JSON.stringify(comando));expect(push).not.toHaveBeenCalled()
 expect(host.textContent).toContain('Confirmar retomada anterior')
 await act(async()=>root.unmount());host.remove();await montar(true)
 expect(retomarAtendimentoAcao).toHaveBeenCalledTimes(1)
 const nova=[...host.querySelectorAll('button')].find(b=>b.textContent==='Retomar atendimento')
 expect(!nova||nova.disabled).toBe(true)
})
test('mudança de ator no mesmo componente não revela nem envia comando de outro usuário',async()=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar()
 await act(async()=>root.render(tela('outro')))
 expect(host.textContent).not.toContain('Confirmar retomada anterior');expect(retomarAtendimentoAcao).not.toHaveBeenCalled()
 expect(sessionStorage.getItem(storage)).toBe(JSON.stringify(comando))
 await act(async()=>root.render(tela()))
 expect(host.textContent).toContain('Confirmar retomada anterior')
})
test.each([
 {tipo:'carteira' as const,empresaId:'desaparecida',url:'/carteira/desaparecida'},
 {tipo:'funil' as const,negociacaoId:'atual',url:'/funil?negociacao=atual'},
 {tipo:'sem_interesse' as const,url:'/fila/localizar?nicho=Luz&endereco=Centro&nome=Aurora&cnpj=12345678901234&disponibilidade=sem_interesse&pagina=1'},
])('replay segue destino atual $tipo, sem recriar contexto antigo',async destino=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar()
 const {url,...d}=destino
 vi.mocked(retomarAtendimentoAcao).mockResolvedValue({ok:true,versao:9,repetida:true,leituraDestino:{ok:true,destino:d}})
 await clicar('Confirmar retomada anterior');expect(push).toHaveBeenCalledWith(url)
})
test.each(['leitura','limpeza','refresh','navegacao'] as const)('falha posterior %s preserva confirmação, não oferece novo envio',async falha=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar()
 vi.mocked(retomarAtendimentoAcao).mockResolvedValue({ok:true,versao:9,repetida:true,leituraDestino:falha==='leitura'||falha==='refresh'?{ok:false,motivo:'leitura_indisponivel'}:{ok:true,destino:{tipo:'atendimento',empresaId:'desaparecida'}}})
 if(falha==='limpeza')vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('storage')})
 if(falha==='refresh')refresh.mockImplementation(()=>{throw new Error('router')})
 if(falha==='navegacao')push.mockImplementation(()=>{throw new Error('router')})
 await clicar('Confirmar retomada anterior')
 expect(host.textContent).toContain('Envio anterior confirmado')
 expect(host.textContent).not.toContain('Não foi possível confirmar')
 expect([...host.querySelectorAll('button')].some(b=>b.textContent==='Confirmar retomada anterior')).toBe(false)
 expect(retomarAtendimentoAcao).toHaveBeenCalledTimes(1)
})
test('recusa conclusiva libera nova intenção e remove somente o comando resolvido',async()=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar(true)
 vi.mocked(retomarAtendimentoAcao).mockResolvedValue({ok:false,motivo:'desatualizada'})
 await clicar('Confirmar retomada anterior')
 expect(sessionStorage.getItem(storage)).toBeNull()
 expect(host.textContent).not.toContain('Confirmar retomada anterior')
 expect(host.textContent).toContain('Retomar atendimento')
})
test('confirmação de A não remove comando B gravado enquanto A era transmitido',async()=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar()
 vi.mocked(retomarAtendimentoAcao).mockImplementation(async()=>{
  sessionStorage.setItem(storage,JSON.stringify({...comando,id:'B',chave:'nova'}))
  return {ok:true,versao:5,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'desaparecida'}}}
 })
 await clicar('Confirmar retomada anterior')
 expect(JSON.parse(sessionStorage.getItem(storage)!).chave).toBe('nova')
 expect(push).not.toHaveBeenCalled()
})

test('trocar ator durante confirmação não navega com a resposta do usuário anterior',async()=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar()
 let resolver!:(r:Awaited<ReturnType<typeof retomarAtendimentoAcao>>)=>void
 vi.mocked(retomarAtendimentoAcao).mockReturnValue(new Promise(r=>resolver=r))
 await clicar('Confirmar retomada anterior')
 await act(async()=>root.render(tela('outro')))
 await act(async()=>resolver({ok:true,versao:5,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'desaparecida'}}}))
 expect(push).not.toHaveBeenCalled();expect(refresh).not.toHaveBeenCalled()
 expect(sessionStorage.getItem(storage)).toBe(JSON.stringify(comando))
})
test('duplo clique pendente envia somente o mesmo comando uma vez',async()=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar()
 let resolver!:(r:Awaited<ReturnType<typeof retomarAtendimentoAcao>>)=>void
 vi.mocked(retomarAtendimentoAcao).mockReturnValue(new Promise(r=>resolver=r))
 await clicar('Confirmar retomada anterior');await clicar('Confirmar retomada anterior')
 expect(retomarAtendimentoAcao).toHaveBeenCalledTimes(1)
 await act(async()=>resolver({ok:false,motivo:'desatualizada'}))
})
test('armazenamento inválido continua visível e bloqueia novas retomadas sem enviar payload forjado',async()=>{
 sessionStorage.setItem(storage,'{');await montar(true)
 expect(host.textContent).toContain('Não foi possível recuperar')
 const nova=[...host.querySelectorAll('button')].find(b=>b.textContent==='Retomar atendimento')!
 expect(nova.disabled).toBe(true);expect(retomarAtendimentoAcao).not.toHaveBeenCalled()
 expect(sessionStorage.getItem(storage)).toBe('{')
})

test('confirmação legada com destino navega sem concorrer com refresh',async()=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));await montar()
 vi.mocked(retomarAtendimentoAcao).mockResolvedValue({ok:true,versao:5,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'desaparecida'}}})
 await clicar('Confirmar retomada anterior')
 expect(push).toHaveBeenCalled();expect(refresh).not.toHaveBeenCalled()
})

const moderno=(id='outra',usuarioId='eu')=>({id,versao:5,chave:'moderna-'+id,tipo:'retomar',usuarioId})
test('retomada nova de Localizar persiste identidade opcional uma vez e recovery sobrevive fora da grade',async()=>{
 await montar(true)
 vi.mocked(retomarAtendimentoAcao).mockRejectedValueOnce(new Error('rede'))
 await clicar('Retomar atendimento')
 const salvo=JSON.parse(sessionStorage.getItem('crm:acao-empresa:v1:outra')!)
 expect(salvo).toMatchObject({id:'outra',versao:5,tipo:'retomar',usuarioId:'eu'})
 expect(retomarAtendimentoAcao).toHaveBeenCalledTimes(1)
 expect(host.querySelector('section[aria-label="Retomada anterior"]')?.textContent).toContain('Confirmar retomada anterior')
 await act(async()=>root.unmount());host.remove();await montar()
 expect(retomarAtendimentoAcao).toHaveBeenCalledTimes(1)
 vi.mocked(retomarAtendimentoAcao).mockResolvedValueOnce({ok:true,versao:6,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'outra'}}})
 await clicar('Confirmar retomada anterior')
 expect(Object.fromEntries(vi.mocked(retomarAtendimentoAcao).mock.calls[1][0])).toEqual({id:'outra',versao:'5',chave:salvo.chave})
 expect(sessionStorage.getItem('crm:acao-empresa:v1:outra')).toBeNull()
})
test('painel enumera somente retomadas modernas identificadas do ator atual, sem replay automático',async()=>{
 const c=moderno('invisivel');sessionStorage.setItem('crm:acao-empresa:v1:invisivel',JSON.stringify(c))
 sessionStorage.setItem('crm:acao-empresa:v1:privada',JSON.stringify(moderno('privada','outro')))
 sessionStorage.setItem('crm:acao-empresa:v1:antiga',JSON.stringify({id:'antiga',versao:4,chave:'sem-ator',tipo:'retomar'}))
 await montar(true)
 expect(retomarAtendimentoAcao).not.toHaveBeenCalled()
 expect(host.textContent).toContain('Confirmar retomada anterior')
 expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Retomar atendimento')?.disabled).toBe(true)
 vi.mocked(retomarAtendimentoAcao).mockResolvedValue({ok:true,versao:6,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'invisivel'}}})
 await clicar('Confirmar retomada anterior')
 expect(Object.fromEntries(vi.mocked(retomarAtendimentoAcao).mock.calls[0][0])).toEqual({id:'invisivel',versao:'5',chave:c.chave})
 expect(sessionStorage.getItem('crm:acao-empresa:v1:privada')).not.toBeNull()
 expect(sessionStorage.getItem('crm:acao-empresa:v1:antiga')).not.toBeNull()
})
test('comando moderno antigo sem ator usa fallback do card sem gerar outra chave',async()=>{
 const c={id:'outra',versao:2,chave:'antiga-sem-ator',tipo:'retomar'}
 sessionStorage.setItem('crm:acao-empresa:v1:outra',JSON.stringify(c));await montar(true)
 expect(host.textContent).not.toContain('Confirmar retomada anterior')
 vi.mocked(retomarAtendimentoAcao).mockResolvedValue({ok:true,versao:6,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'outra'}}})
 await clicar('Retomar atendimento')
 expect(retomarAtendimentoAcao).toHaveBeenCalledTimes(1)
 expect(Object.fromEntries(vi.mocked(retomarAtendimentoAcao).mock.calls[0][0])).toEqual({id:c.id,versao:'2',chave:c.chave})
 expect(sessionStorage.getItem('crm:acao-empresa:v1:outra')).toBeNull()
})
test.each(['sem_permissao','nao_encontrada'] as const)('retomada moderna conserva alvo/versão/chave e bloqueia outras após %s',async motivo=>{
 const c=moderno('invisivel'),key='crm:acao-empresa:v1:invisivel';sessionStorage.setItem(key,JSON.stringify(c));await montar(true)
 vi.mocked(retomarAtendimentoAcao).mockResolvedValue({ok:false,motivo})
 await clicar('Confirmar retomada anterior')
 expect(sessionStorage.getItem(key)).toBe(JSON.stringify(c))
 expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Retomar atendimento')?.disabled).toBe(true)
 expect(push).not.toHaveBeenCalled()
})
test('troca de ator durante retomada moderna não navega nem remove comando do usuário anterior',async()=>{
 await montar(true)
 let resolver!:(r:Awaited<ReturnType<typeof retomarAtendimentoAcao>>)=>void
 vi.mocked(retomarAtendimentoAcao).mockReturnValue(new Promise(r=>resolver=r))
 await clicar('Retomar atendimento')
 const salvo=sessionStorage.getItem('crm:acao-empresa:v1:outra')
 await act(async()=>root.render(tela('outro')))
 expect(host.textContent).not.toContain('Confirmar retomada anterior')
 await act(async()=>resolver({ok:true,versao:6,repetida:false,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'outra'}}}))
 expect(push).not.toHaveBeenCalled();expect(sessionStorage.getItem('crm:acao-empresa:v1:outra')).toBe(salvo)
})
test('comandos legado e moderno são confirmados manualmente sem segundo replay automático',async()=>{
 sessionStorage.setItem(storage,JSON.stringify(comando));sessionStorage.setItem('crm:acao-empresa:v1:outra',JSON.stringify(moderno()))
 await montar()
 vi.mocked(retomarAtendimentoAcao).mockResolvedValue({ok:true,versao:6,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'outra'}}})
 await clicar('Confirmar retomada anterior')
 expect(retomarAtendimentoAcao).toHaveBeenCalledTimes(1);expect(push).not.toHaveBeenCalled()
 expect(host.textContent).toContain('Confirmar retomada anterior')
 await clicar('Confirmar retomada anterior')
 expect(retomarAtendimentoAcao).toHaveBeenCalledTimes(2)
 expect(vi.mocked(retomarAtendimentoAcao).mock.calls[1][0].get('chave')).toBe('moderna-outra')
})

test('comando prévio de iniciar com metadado não é sobrescrito pela intenção de retomar',async()=>{
 const c={id:'outra',versao:2,chave:'inicio-preservado',tipo:'iniciar',usuarioId:'eu'}
 sessionStorage.setItem('crm:acao-empresa:v1:outra',JSON.stringify(c));await montar(true)
 vi.mocked(iniciarAtendimentoAcao).mockResolvedValue({ok:true,versao:6,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'outra'}}})
 await clicar('Retomar atendimento')
 expect(retomarAtendimentoAcao).not.toHaveBeenCalled()
 expect(Object.fromEntries(vi.mocked(iniciarAtendimentoAcao).mock.calls[0][0])).toEqual({id:c.id,versao:'2',chave:c.chave})
})
test('comando identificado de outro ator não é enumerado, reenviado nem sobrescrito pela nova intenção',async()=>{
 const c=moderno('outra','outro'),key='crm:acao-empresa:v1:outra'
 sessionStorage.setItem(key,JSON.stringify(c));await montar(true)
 expect(host.textContent).not.toContain('Confirmar retomada anterior')
 await clicar('Retomar atendimento')
 expect(retomarAtendimentoAcao).not.toHaveBeenCalled();expect(sessionStorage.getItem(key)).toBe(JSON.stringify(c))
 expect(host.textContent).not.toContain('moderna-outra');expect(host.textContent).not.toContain('outro')
})
test('retomada nova pendente tem um só emissor, chave e registro; confirmação fica bloqueada',async()=>{
 await montar(true)
 let resolver!:(r:Awaited<ReturnType<typeof retomarAtendimentoAcao>>)=>void
 vi.mocked(retomarAtendimentoAcao).mockReturnValue(new Promise(r=>resolver=r))
 await clicar('Retomar atendimento')
 const salvo=sessionStorage.getItem('crm:acao-empresa:v1:outra')
 await clicar('Retomar atendimento');await clicar('Confirmar retomada anterior')
 expect(retomarAtendimentoAcao).toHaveBeenCalledTimes(1)
 expect(sessionStorage.getItem('crm:acao-empresa:v1:outra')).toBe(salvo)
 await act(async()=>resolver({ok:false,motivo:'desatualizada'}))
})
test('confirmação moderna não limpa intenção posterior no mesmo namespace',async()=>{
 const key='crm:acao-empresa:v1:outra';sessionStorage.setItem(key,JSON.stringify(moderno()));await montar()
 const posterior={...moderno(),chave:'posterior',versao:9}
 vi.mocked(retomarAtendimentoAcao).mockImplementation(async()=>{
  sessionStorage.setItem(key,JSON.stringify(posterior))
  return {ok:true,versao:6,repetida:true,leituraDestino:{ok:true,destino:{tipo:'atendimento',empresaId:'outra'}}}
 })
 await clicar('Confirmar retomada anterior')
 expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(posterior);expect(push).not.toHaveBeenCalled()
 expect(host.textContent).toContain('Confirmar retomada anterior')
})
