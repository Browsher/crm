import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
const m=vi.hoisted(()=>({exigir:vi.fn(),ler:vi.fn(),contar:vi.fn()}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:m.exigir}))
vi.mock('@/src/features/funil/consulta',()=>({lerFunil:m.ler,contarSemInteresse:m.contar,lerEmpresaArquivadaDaNegociacao:vi.fn()}))
vi.mock('@/src/components/crm/empresa-arquivada',()=>({empresaArquivada:vi.fn()}))
vi.mock('./quadro',()=>({Quadro:()=> <p>Quadro autorizado</p>}))
import Pagina from './page'
beforeEach(()=>{vi.resetAllMocks();m.exigir.mockResolvedValue({usuarioId:'eu'});m.ler.mockResolvedValue([])})
test('gate de leitura de Sem interesse continua negando quadro quando lerFunil devolve vazio',async()=>{
 m.contar.mockResolvedValue({ok:false,motivo:'sem_permissao'})
 const html=renderToStaticMarkup(await Pagina({searchParams:Promise.resolve({})}))
 expect(html).toContain('role="alert"');expect(html).not.toContain('Quadro autorizado')
 expect(m.contar).toHaveBeenCalledWith('eu')
})
test('autorização total permite quadro vazio sem apresentar card de arquivo',async()=>{
 m.contar.mockResolvedValue({ok:true,total:9})
 const html=renderToStaticMarkup(await Pagina({searchParams:Promise.resolve({})}))
 expect(html).toContain('Quadro autorizado');expect(html).not.toContain('Consultar arquivo')
})
