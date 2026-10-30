// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
const iniciar=vi.hoisted(()=>vi.fn())
const push=vi.hoisted(()=>vi.fn())
const refresh=vi.hoisted(()=>vi.fn())
vi.mock('./atendimento/acoes',()=>({iniciarAtendimentoAcao:iniciar,retomarAtendimentoAcao:iniciar}))
vi.mock('next/navigation',()=>({useRouter:()=>({push,refresh})}))
vi.mock('@/src/components/crm/empresa-dialogo',()=>({EmpresaDialogo:({aoFechar}:{aoFechar:()=>void})=><div role="dialog"><button onClick={aoFechar}>Fechar</button></div>}))
import { Cartao } from './cartao'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
const empresa:ResumoEmpresa={referencia:{tipo:'cadastro',empresaId:'A'},id:'A',nome:'Aurora',cnpj:null,cnae:null,atividade:null,bairro:null,cidade:null,uf:null,origens:['google'],recebidaEm:null,situacao:'a_contatar',versao:2,negociacaoId:null}
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
beforeEach(()=>{sessionStorage.clear();vi.clearAllMocks();host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
async function montar(e=empresa,hrefCarteira?:string){await act(async()=>root.render(<Cartao empresa={e} filtros={{origem:'google',pagina:'3'}} hrefCarteira={hrefCarteira}/>))}
async function clicar(texto:string){await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===texto)!.click())}
test('Ver empresa usa diálogo informativo, fechar não inicia nem navega',async()=>{
  await montar();await clicar('Ver empresa');expect(host.querySelector('[role=dialog]')).not.toBeNull()
  await clicar('Fechar');expect(iniciar).not.toHaveBeenCalled();expect(push).not.toHaveBeenCalled()
})
test('recusa temporária de autorização não abandona chave de início desconhecido',async()=>{
  iniciar.mockRejectedValueOnce(new Error('rede'));await montar();await clicar('Iniciar atendimento')
  const primeiro=Object.fromEntries(iniciar.mock.calls[0][0])
  iniciar.mockResolvedValueOnce({ok:false,motivo:'sem_permissao'});await clicar('Iniciar atendimento')
  expect(host.textContent).not.toContain('Atualizar empresa')
  iniciar.mockResolvedValueOnce({ok:true,versao:3,repetida:true});await clicar('Iniciar atendimento')
  expect(Object.fromEntries(iniciar.mock.calls[2][0])).toEqual(primeiro)
  expect(sessionStorage.getItem('crm:acao-empresa:v1:A')).toBeNull()
})
test('início perdido repete mesma chave/versão mesmo após remount, depois abre empresa explícita',async()=>{
  iniciar.mockRejectedValueOnce(new Error('rede'));await montar();await clicar('Iniciar atendimento')
  const primeiro=Object.fromEntries(iniciar.mock.calls[0][0])
  await act(async()=>root.render(null));await montar({...empresa,versao:20})
  iniciar.mockResolvedValueOnce({ok:true,versao:3,repetida:true});await clicar('Iniciar atendimento')
  expect(Object.fromEntries(iniciar.mock.calls[1][0])).toEqual(primeiro)
  expect(push).toHaveBeenCalledWith('/fila/atendimento/A?origem=google&pagina=3')
  expect(refresh).toHaveBeenCalled()
})
test('continuar conserva filtros e snapshot sem vínculo não ganha comando',async()=>{
  await montar({...empresa,situacao:'atendimento'});await clicar('Continuar atendimento')
  expect(push).toHaveBeenCalledWith('/fila/atendimento/A?origem=google&pagina=3')
  await montar({...empresa,id:null,versao:null,referencia:{tipo:'busca',buscaId:'B',cnpj:'12345678000199'},situacao:'indisponivel'})
  expect([...host.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['Ver empresa'])
  expect(iniciar).not.toHaveBeenCalled()
})
test('resposta de início perdida é confirmada mesmo quando a leitura já mostra atendimento',async()=>{
  iniciar.mockRejectedValueOnce(new Error('rede'));await montar();await clicar('Iniciar atendimento')
  const primeiro=Object.fromEntries(iniciar.mock.calls[0][0])
  await montar({...empresa,situacao:'atendimento',versao:3})
  iniciar.mockResolvedValueOnce({ok:true,versao:3,repetida:true});await clicar('Continuar atendimento')
  expect(iniciar).toHaveBeenCalledTimes(2)
  expect(Object.fromEntries(iniciar.mock.calls[1][0])).toEqual(primeiro)
  expect(sessionStorage.getItem('crm:acao-empresa:v1:A')).toBeNull()
})
test('abrir carteira conserva filtros locais após confirmar comando desconhecido',async()=>{
  iniciar.mockRejectedValueOnce(new Error('rede'))
  await montar({...empresa,situacao:'sem_interesse'});await clicar('Retomar atendimento')
  const primeiro=Object.fromEntries(iniciar.mock.calls[0][0])
  const href='/carteira/A?de=meu-dia&nome=Aurora&retorno=hoje'
  await montar({...empresa,situacao:'cliente',versao:3},href)
  iniciar.mockRejectedValueOnce(new Error('rede'));await clicar('Abrir na carteira')
  expect(push).not.toHaveBeenCalled()
  expect(Object.fromEntries(iniciar.mock.calls[1][0])).toEqual(primeiro)
  iniciar.mockResolvedValueOnce({ok:true,versao:3,repetida:true});await clicar('Abrir na carteira')
  expect(Object.fromEntries(iniciar.mock.calls[2][0])).toEqual(primeiro)
  expect(push).toHaveBeenCalledWith(href)
})
test('carteira ignora destino externo e conserva destino canônico',async()=>{
  await montar({...empresa,situacao:'cliente'},'https://example.com/fora');await clicar('Abrir na carteira')
  expect(push).toHaveBeenCalledWith('/carteira/A')
})
