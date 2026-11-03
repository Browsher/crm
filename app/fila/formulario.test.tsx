// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
const replace=vi.hoisted(()=>vi.fn())
const salvo=vi.hoisted(()=>({retorno:{ok:true,leituraDestino:{ok:true,destino:{tipo:'permanecer'}}} as unknown}))
vi.mock('next/navigation',()=>({useRouter:()=>({replace})}))
vi.mock('./cartao',()=>({Cartao:()=> <p>Dados</p>}))
vi.mock('@/src/features/contato/formulario',()=>({FormularioContato:({somenteConfirmacao,onSaved}:{somenteConfirmacao:boolean;onSaved:(id:string,r:unknown)=>void})=> somenteConfirmacao ? <span data-confirmacao /> : <form aria-label="Contato"><button type="button" onClick={()=>onSaved('A',salvo.retorno)}>Salvar teste</button></form>}))
import { Formulario } from './formulario'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
const empresa:ResumoEmpresa={referencia:{tipo:'cadastro',empresaId:'A'},id:'A',nome:'Aurora',cnpj:null,cnae:null,atividade:null,bairro:null,cidade:null,uf:null,origens:['banco'],recebidaEm:null,situacao:'atendimento',versao:2,negociacaoId:null}
test('atendimento mostra registro e histórico sem prazo ou próxima empresa',()=>{
  const html=renderToStaticMarkup(<Formulario empresa={empresa} fase="inicial" filtros={{}} contatos={[]}/>)
  expect(html).toContain('aria-label="Contato"');expect(html).not.toMatch(/30 minutos|Próxima|Puxar|reserva/)
})
test.each(['a_contatar','sem_interesse','indisponivel'] as const)('%s não habilita registro até ação explícita',situacao=>{
  const html=renderToStaticMarkup(<Formulario empresa={{...empresa,situacao}} fase="inicial" filtros={{}} contatos={[]}/>)
  expect(html).not.toContain('<form')
  expect(html).toContain('data-confirmacao')
})

afterEach(()=>{replace.mockClear()})
test.each([
 [{ok:true,leituraDestino:{ok:true,destino:{tipo:'funil',negociacaoId:'nova'}}},'/funil?negociacao=nova'],
 [{ok:true,leituraDestino:{ok:true,destino:{tipo:'sem_interesse'}}},'/fila/localizar?origem=google&nome=Aurora&disponibilidade=sem_interesse&pagina=1'],
 [{ok:true,leituraDestino:{ok:true,destino:{tipo:'permanecer'}}},null],
 [{ok:true,leituraDestino:{ok:false,motivo:'leitura_indisponivel'}},null],
 [{ok:false},null],
])('rota constrói destino local e replace somente após confirmação %j',async(retorno,url)=>{
 salvo.retorno=retorno
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 try{
  await act(async()=>root.render(<Formulario empresa={empresa} fase="inicial" filtros={{origem:'google',nome:'Aurora',pagina:'3'}} contatos={[]}/>))
  await act(async()=>host.querySelector('button')!.click())
  if(url)expect(replace).toHaveBeenCalledWith(url);else expect(replace).not.toHaveBeenCalled()
 }finally{await act(async()=>root.unmount());host.remove()}
})
