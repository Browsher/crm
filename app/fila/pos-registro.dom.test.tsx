// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const gravar=vi.hoisted(()=>vi.fn())
const replace=vi.hoisted(()=>vi.fn())
vi.mock('@/src/features/contato/acao',()=>({registrarContatoAcao:gravar,prepararContatoAcao:async()=>({ok:true,fase:'inicial',empresa:{versao:8,situacao:'atendimento'}})}))
vi.mock('next/navigation',()=>({useRouter:()=>({replace,refresh:vi.fn()})}))
vi.mock('./cartao',()=>({Cartao:()=>null}))
import { Formulario } from './formulario'
import { RascunhosProvider, useRascunhos } from './rascunhos'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
const empresa:ResumoEmpresa={referencia:{tipo:'cadastro',empresaId:'A'},id:'A',nome:'Aurora',cnpj:null,cnae:null,atividade:null,bairro:null,cidade:null,uf:null,origens:['banco'],recebidaEm:null,situacao:'atendimento',versao:2,negociacaoId:null}
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
beforeEach(()=>{vi.resetAllMocks();sessionStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
function Entradas(){const {entradas}=useRascunhos();return <p data-entradas>{Object.keys(entradas).join(',')}</p>}
test('sucesso da rota limpa rascunho correspondente no contexto e abre negociação autenticada',async()=>{
 gravar.mockResolvedValue({ok:true,erro:null,leituraDestino:{ok:true,destino:{tipo:'funil',negociacaoId:'atual'}}})
 await act(async()=>root.render(<RascunhosProvider><Entradas/><Formulario empresa={empresa} fase="inicial" contatos={[]} filtros={{}}/></RascunhosProvider>))
 await act(async()=>{const campo=host.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(campo,'Nota A');campo.dispatchEvent(new Event('input',{bubbles:true}))})
 expect(host.querySelector('[data-entradas]')!.textContent).toBe('A')
 await act(async()=>host.querySelector('form')!.requestSubmit())
 expect(host.querySelector('[data-entradas]')!.textContent).toBe('')
 expect(replace).toHaveBeenCalledWith('/funil?negociacao=atual')
})
