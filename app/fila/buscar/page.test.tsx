import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
const mocks = vi.hoisted(()=>({ler:vi.fn(),recentes:vi.fn(),repo:{meuLimite:vi.fn().mockResolvedValue({limite_diario:100,usado:0,pausado:false}),listar:vi.fn().mockResolvedValue([]),ler:vi.fn().mockResolvedValue(null)}}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:vi.fn().mockResolvedValue({usuarioId:'vendedor-certo'})}))
vi.mock('@/src/features/busca-empresas/repositorio',()=>({repositorioBusca:()=>mocks.repo}))
vi.mock('@/src/server/prospeccao-pessoal',()=>({lerEmpresasPessoais:mocks.ler}))
vi.mock('./empresas-recentes',()=>({EmpresasBancoRecentes:(props:unknown)=>{mocks.recentes(props);return <section>Empresas recentes</section>}}))
vi.mock('./formulario',()=>({FormularioBusca:()=> <form/>}))
vi.mock('../google/page',()=>({default:()=> <main>Google</main>}))
import PaginaBuscar from './page'

test('consulta pessoal é do vendedor e do banco e só envia 11 empresas ao carrossel',async()=>{
 const empresas=Array.from({length:20},(_,i)=>({id:String(i)}))
 mocks.ler.mockResolvedValueOnce({ok:true,dados:{empresas,total:20}})
 mocks.recentes.mockClear()
 const html=renderToStaticMarkup(await PaginaBuscar({searchParams:Promise.resolve({fonte:'banco'})}))
 expect(mocks.ler).toHaveBeenLastCalledWith('vendedor-certo',{origem:'banco'})
 expect(mocks.recentes.mock.calls[0][0].empresas).toEqual(empresas.slice(0,11))
 expect(html).toContain('Empresas recentes')
})
test('falha explícita de leitura mostra mensagem e não impede o formulário',async()=>{
 mocks.ler.mockResolvedValueOnce({ok:false,motivo:'sem_permissao'})
 const html=renderToStaticMarkup(await PaginaBuscar({searchParams:Promise.resolve({})}))
 expect(html).toContain('Não foi possível carregar suas empresas recentes')
 expect(html).toContain('<form')
})

test('indisponibilidade da leitura também preserva o formulário',async()=>{
 mocks.ler.mockRejectedValueOnce(new Error('infra indisponível'))
 const html=renderToStaticMarkup(await PaginaBuscar({searchParams:Promise.resolve({})}))
 expect(html).toContain('Não foi possível carregar suas empresas recentes')
 expect(html).toContain('<form')
})
