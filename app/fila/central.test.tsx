import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'eu'})}))
vi.mock('@/src/features/fila/consulta',()=>({lerMinhasEmpresas:async()=>({ok:true,reserva:null,carteira:[],contexto:null})}))
vi.mock('@/src/features/contato/historico',()=>({lerHistorico:async()=>({ok:true,contatos:[]})}))
vi.mock('@/src/server/grupos/prospeccao',()=>({listarGruposProspeccao:async()=>({ok:true,grupos:[],temProxima:false}),lerGrupoProspeccao:async()=>null}))
vi.mock('./entrada-sem-reserva',()=>({EntradaSemReserva:()=>null}))
vi.mock('./formulario',()=>({Formulario:()=>null}))
import Pagina from './page'

test('entrada da Prospecção é a central aprovada com origem e ações explícitas',async()=>{
  const html = renderToStaticMarkup(await Pagina({searchParams:Promise.resolve({})}))
  for(const texto of ['Escolha o que você quer fazer.','Origem das empresas','Planejar buscas','Buscar novas empresas']) expect(html).toContain(texto)
  expect(html).toContain('action="/fila/localizar"')
  expect(html).not.toContain('Escolha uma lista para prospectar')
})
