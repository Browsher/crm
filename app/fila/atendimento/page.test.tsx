import { beforeEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
const ler = vi.hoisted(() => vi.fn())
const iniciar = vi.hoisted(() => vi.fn())
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({usuarioId:'eu'}) }))
vi.mock('@/src/server/atendimento/consulta', () => ({lerAtendimento:ler}))
vi.mock('@/src/server/atendimento/operacoes', () => ({iniciarAtendimento:iniciar}))
vi.mock('@/src/features/contato/historico',()=>({lerHistorico:async()=>({ok:true,contatos:[]})}))
vi.mock('../formulario',()=>({Formulario:({empresa}:{empresa:{nome:string}})=><p>{empresa.nome}</p>}))
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('404')}}))
import Pagina from './[id]/page'
beforeEach(()=>{vi.clearAllMocks();ler.mockResolvedValue({ok:true,empresa:{id:'A',nome:'Aurora'},fase:'inicial'})})
test('abrir atendimento lê somente ID explícito sem iniciar e preserva filtros locais',async()=>{
  const html=renderToStaticMarkup(await Pagina({params:Promise.resolve({id:'A'}),searchParams:Promise.resolve({origem:'google',pagina:'3',grupo:'legado',voltar:'https://fora.test'})}))
  expect(ler).toHaveBeenCalledWith('eu','A');expect(iniciar).not.toHaveBeenCalled()
  expect(html).toContain('/fila/localizar?origem=google&amp;pagina=3')
  expect(html).not.toContain('grupo=')
})
test('ID de outro vendedor não renderiza formulário nem adquire próximo',async()=>{
  ler.mockResolvedValue({ok:false,motivo:'sem_permissao'})
  await expect(Pagina({params:Promise.resolve({id:'alheia'}),searchParams:Promise.resolve({})})).rejects.toThrow('404')
  expect(iniciar).not.toHaveBeenCalled()
})