import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import Pagina from './page'
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'vendedor'})}))
vi.mock('@/src/features/google/regras',async importar=>({...await importar<typeof import('@/src/features/google/regras')>(),hojeEmSaoPaulo:()=> '2026-10-22'}))
vi.mock('@/src/features/google/repositorio',()=>({repositorioGoogle:()=>({semana:async()=>[],rotina:async()=>false,
  agentes:async()=>[{vendedor_id:'vendedor',nome:'Ana',pausado:false,disponivel:true,estado:null,ultimo_inicio:null}],historicoPlanejamento:async()=>[]})}))
test('planejamento padrão mostra a semana atual e destaca hoje',async()=>{
  const html=renderToStaticMarkup(await Pagina({searchParams:Promise.resolve({})}))
  expect(html).toContain('dateTime="2026-10-19"')
  expect(html).toContain('Hoje')
  expect(html).not.toContain('Leads recebidos')
  expect(html).toContain('Consultar empresas do Google')
})
