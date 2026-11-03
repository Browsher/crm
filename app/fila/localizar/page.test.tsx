import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
const m=vi.hoisted(()=>({exigir:vi.fn(),ler:vi.fn(),redirect:vi.fn((url:string)=>{throw new Error('REDIRECT '+url)})}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:m.exigir}))
vi.mock('@/src/server/prospeccao-pessoal',()=>({lerEmpresasPessoais:m.ler}))
vi.mock('next/navigation',()=>({redirect:m.redirect,useRouter:()=>({push:vi.fn()})}))
vi.mock('./pessoal',()=>({LocalizarPessoal:({filtros}:{filtros:unknown})=><p>{JSON.stringify(filtros)}</p>}))
vi.mock('./recuperacao-retomada',()=>({RecuperacaoRetomada:({usuarioId,children}:{usuarioId:string;children:React.ReactNode})=><section data-recuperacao={usuarioId}>{children}</section>}))
import Pagina from './page'
import Antiga from '../sem-interesse/page'
beforeEach(()=>{vi.clearAllMocks();m.exigir.mockResolvedValue({usuarioId:'eu'});m.ler.mockResolvedValue({ok:true,dados:{empresas:[],total:0,nichos:[],bairros:[]}})})
test('origem visual normaliza antes do parser e encaminha para URL canônica',async()=>{
 await expect(Pagina({searchParams:Promise.resolve({origem:'sem_interesse',nicho:'Luz',endereco:'Centro',pagina:'2'})})).rejects.toThrow('REDIRECT /fila/localizar?nicho=Luz&endereco=Centro&disponibilidade=sem_interesse&pagina=2')
 expect(m.ler).not.toHaveBeenCalled()
})
test('rota antiga autentica antes de encaminhar e conserva filtros válidos',async()=>{
 const params={nome:'Aurora',cnpj:'12.345.678/9012-34',nicho:'Luz',endereco:'Centro',pagina:'3'}
 await expect(Antiga({searchParams:Promise.resolve(params)})).rejects.toThrow('REDIRECT /fila/localizar?nicho=Luz&endereco=Centro&nome=Aurora&cnpj=12345678901234&disponibilidade=sem_interesse&pagina=3')
 expect(m.exigir).toHaveBeenCalledWith('vendedor')
 expect(m.exigir.mock.invocationCallOrder[0]).toBeLessThan(m.redirect.mock.invocationCallOrder[0])
 expect(m.ler).not.toHaveBeenCalled()
})
test('rota antiga não encaminha nem consulta sem autenticação',async()=>{
 m.exigir.mockRejectedValueOnce(new Error('sem sessão'))
 await expect(Antiga({searchParams:Promise.resolve({})})).rejects.toThrow('sem sessão')
 expect(m.redirect).not.toHaveBeenCalled();expect(m.ler).not.toHaveBeenCalled()
})
test.each([Pagina,Antiga])('filtro inválido mantém erro visível e recuperação por ator fora da grade',async pagina=>{
 const html=renderToStaticMarkup(await pagina({searchParams:Promise.resolve({pagina:['2','3'],nome:'Aurora'})}))
 expect(html).toContain('role="alert"');expect(html).toContain('inválido')
 expect(html).toContain('data-recuperacao="eu"')
 expect(m.redirect).not.toHaveBeenCalled();expect(m.ler).not.toHaveBeenCalled()
 if(pagina===Antiga)expect(html).toContain('disponibilidade=sem_interesse')
})
test('consulta autorizada usa recorte existente e inclui recuperação sem resultados',async()=>{
 const html=renderToStaticMarkup(await Pagina({searchParams:Promise.resolve({disponibilidade:'sem_interesse',pagina:'2'})}))
 expect(m.ler).toHaveBeenCalledWith('eu',{disponibilidade:'sem_interesse',pagina:'2'})
 expect(html).toContain('data-recuperacao="eu"')
})

for(const [nome,pagina,origem] of [['antiga',Antiga,undefined],['alias',Pagina,'sem_interesse']] as const){
 test.each([{disponibilidade:'invalida'},{disponibilidade:['sem_interesse','sem_interesse']}])('rota '+nome+' conserva erro e painel quando disponibilidade é %j',async({disponibilidade})=>{
  const html=renderToStaticMarkup(await pagina({searchParams:Promise.resolve({origem,disponibilidade,nome:'Aurora'})}))
  expect(html).toContain('role="alert"');expect(html).toContain('inválido');expect(html).toContain('data-recuperacao="eu"')
  expect(m.redirect).not.toHaveBeenCalled();expect(m.ler).not.toHaveBeenCalled()
 })
}
