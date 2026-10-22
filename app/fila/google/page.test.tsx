import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import Pagina from './page'
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'vendedor'})}))
vi.mock('@/src/features/google/regras',async importar=>({...await importar<typeof import('@/src/features/google/regras')>(),hojeEmSaoPaulo:()=> '2026-10-22'}))
vi.mock('@/src/features/google/repositorio',()=>({repositorioGoogle:()=>({semana:async()=>[],rotina:async()=>false,
  agentes:async()=>[{vendedor_id:'vendedor',nome:'Ana',pausado:false,disponivel:true,estado:null,ultimo_inicio:null}]})}))
test('planejamento padrão mostra os próximos cinco dias e mantém o histórico semanal acessível',async()=>{
  const html=renderToStaticMarkup(await Pagina({searchParams:Promise.resolve({})}))
  expect(html).toContain('Próximos cinco dias úteis')
  expect(html).toContain('dateTime="2026-10-26"')
  expect(html).not.toContain('dateTime="2026-10-19"')
  expect(html).toContain('Seu agente de busca')
  expect(html).toContain('Leads recebidos')
})
