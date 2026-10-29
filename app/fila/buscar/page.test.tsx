import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
const mocks = vi.hoisted(()=>({ler:vi.fn().mockResolvedValue({ok:true,dados:{empresas:[]}}),recentes:vi.fn(),repo:{empresasRecentes:vi.fn(),meuLimite:vi.fn().mockResolvedValue({limite_diario:100,usado:0,pausado:false}),listar:vi.fn().mockResolvedValue([]),ler:vi.fn().mockResolvedValue(null)}}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:vi.fn().mockResolvedValue({usuarioId:'vendedor-certo'})}))
vi.mock('@/src/features/busca-empresas/repositorio',()=>({repositorioBusca:()=>mocks.repo}))
vi.mock('@/src/server/prospeccao-pessoal',()=>({lerEmpresasPessoais:mocks.ler}))
vi.mock('./empresas-recentes',()=>({EmpresasBancoRecentes:(props:unknown)=>{mocks.recentes(props);return <section>Empresas recentes</section>}}))
vi.mock('./formulario',()=>({FormularioBusca:()=> <form/>}))
vi.mock('../google/page',()=>({default:()=> <main>Google</main>}))
vi.mock('@/src/server/atendimento/consulta',()=>({lerResumosEmpresas:async()=>({ok:true,empresas:[]}),lerResumosBusca:async()=>({ok:true,empresas:[]})}))
import PaginaBuscar from './page'

test('consulta pessoal é do vendedor e do banco e só envia 11 empresas ao carrossel',async()=>{
 const empresas=Array.from({length:20},(_,i)=>({id:String(i)}))
 mocks.repo.empresasRecentes.mockResolvedValueOnce(empresas)
 mocks.recentes.mockClear()
 const html=renderToStaticMarkup(await PaginaBuscar({searchParams:Promise.resolve({fonte:'banco'})}))
 expect(mocks.repo.empresasRecentes).toHaveBeenCalledOnce()
 expect(mocks.recentes.mock.calls[0][0].empresas).toEqual(empresas.slice(0,11))
 expect(html).toContain('Empresas recentes')
})
test('falha explícita de leitura mostra mensagem e não impede o formulário',async()=>{
 mocks.repo.empresasRecentes.mockRejectedValueOnce(new Error('sem permissão'))
 const html=renderToStaticMarkup(await PaginaBuscar({searchParams:Promise.resolve({})}))
 expect(html).toContain('Não foi possível carregar suas empresas recentes')
 expect(html).toContain('<form')
})

test('indisponibilidade da leitura também preserva o formulário',async()=>{
 mocks.repo.empresasRecentes.mockRejectedValueOnce(new Error('infra indisponível'))
 const html=renderToStaticMarkup(await PaginaBuscar({searchParams:Promise.resolve({})}))
 expect(html).toContain('Não foi possível carregar suas empresas recentes')
 expect(html).toContain('<form')
})

test('histórico vertical não fica duplicado na página do carrossel',async()=>{
 mocks.repo.empresasRecentes.mockResolvedValueOnce([])
 mocks.repo.listar.mockResolvedValueOnce([{id:'historico',nome:'Registro que fica no diálogo',filtros:{quantidade:1},estado:'concluida',retornadas:0,criado_em:'2026-10-27T12:00Z'}])
 const html=renderToStaticMarkup(await PaginaBuscar({searchParams:Promise.resolve({})}))
 expect(html).not.toContain('Registro que fica no diálogo')
 expect(html).toContain('Ver histórico de buscas')
})
