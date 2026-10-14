import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
const estado = vi.hoisted(() => ({reserva:null as unknown, listar:vi.fn(), params:{} as Record<string,string>}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'eu'})}))
vi.mock('@/src/features/fila/consulta',()=>({lerMinhasEmpresas:async()=>({ok:true,reserva:estado.reserva,contexto:null})}))
vi.mock('@/src/features/contato/historico',()=>({lerHistorico:async()=>({ok:true,contatos:[]})}))
vi.mock('@/src/server/grupos/prospeccao',()=>({lerGrupoProspeccao:async()=>({ok:true,grupo:lista}),listarGruposProspeccao:estado.listar}))
vi.mock('./formulario',()=>({Formulario:()=> <div>Atendimento preservado</div>}))
vi.mock('./entrada-sem-reserva',()=>({EntradaSemReserva:()=> <div>Sem reserva</div>}))
vi.mock('./localizar/formulario',()=>({Formulario:()=> <div>Refinar busca</div>}))
vi.mock('./localizar/reservar',()=>({Reservar:()=> null}))
vi.mock('./etapas',()=>({EtapasFila:()=> null}))
vi.mock('@/src/features/prospeccao/repositorio',()=>({listarOpcoes:async()=>({ok:true,opcoes:[]}),consultarEmpresas:async()=>({ok:true,empresas:[],temProxima:false})}))
vi.mock('@/src/features/prospeccao/recentes',()=>({listarRecentes:async()=>({ok:true,empresas:[]}),listarSugestoes:async()=>({ok:true,empresas:[]})}))
import { GruposProspeccao } from './grupos'
import PaginaFila from './page'
import PaginaLocalizar from './localizar/page'
const lista = {id:'00000000-0000-4000-8000-000000000701',nome:'Mooca',descricao:null,origem:null,criterios:null,criadoEm:'2026-10-13T12:00:00Z',total:3,disponiveis:1}
beforeEach(()=> {estado.reserva=null;vi.clearAllMocks();estado.listar.mockResolvedValue({ok:true,grupos:[lista],temProxima:false})})
test('entrada da fila oferece cartão comercial da lista ativa sem reserva',async()=>{
  const html=renderToStaticMarkup(await PaginaFila({searchParams:Promise.resolve({})}))
  expect(html).toContain('<article')
  expect(html).toContain('Mooca')
  expect(html).toContain('Prospectar esta lista')
})
test('busca aberta para escolher lista apresenta catálogo conservando a consulta',async()=>{
  const html=renderToStaticMarkup(await PaginaLocalizar({searchParams:Promise.resolve({escolher_lista:'1',grupo:lista.id,nome:'Aurora',pagina:'3'})}))
  expect(html).toContain('<article')
  expect(html).toContain('Prospectar esta lista')
})

test('atendimento mantém formulário antes do chooser e preserva refinamentos na paginação do catálogo',async()=>{
  estado.reserva={id:'reservada'}
  estado.listar.mockResolvedValue({ok:true,grupos:[lista],temProxima:true})
  const html=renderToStaticMarkup(await PaginaFila({searchParams:Promise.resolve({escolher_lista:'1',grupo:lista.id,nome:'Aurora',cnae:'1234567',pagina:'3',listas_pagina:'2'})}))
  expect(html.indexOf('Atendimento preservado')).toBeLessThan(html.indexOf('<article'))
  expect(html).toContain(`href="/fila?nome=Aurora&amp;cnae=1234567&amp;grupo=${lista.id}&amp;pagina=3&amp;escolher_lista=1&amp;listas_pagina=3"`)
  expect(html).toContain(`href="/fila?grupo=${lista.id}&amp;pagina=1"`)
  expect(estado.listar).toHaveBeenCalledWith('eu',2)
})
test('atendimento não carrega catálogo quando a escolha está fechada',async()=>{
  estado.reserva={id:'reservada'}
  const html=renderToStaticMarkup(await PaginaFila({searchParams:Promise.resolve({})}))
  expect(html).not.toContain('<article')
  expect(estado.listar).not.toHaveBeenCalled()
})
test('página do catálogo inválida avisa sem consultar listas ou apagar o atendimento',async()=>{
  estado.reserva={id:'reservada'}
  const html=renderToStaticMarkup(await PaginaFila({searchParams:Promise.resolve({escolher_lista:'1',listas_pagina:'abc'})}))
  expect(html).toContain('Página de listas inválida')
  expect(html).toContain('Atendimento preservado')
  expect(estado.listar).not.toHaveBeenCalled()
})

test('explica uma lista antiga sem inventar a origem e mantém CTA real',()=>{
  const html=renderToStaticMarkup(<GruposProspeccao grupos={[lista]} pagina={1} temProxima={false} />)
  expect(html).toContain('Origem não informada')
  expect(html).toContain('Prospectar esta lista')
  expect(html).toContain(`href="/fila/localizar?grupo=${lista.id}&amp;pagina=1"`)
  expect(html).not.toContain('<details')
})
test('novas listas exibem texto simples, critérios expansíveis e contagens por lista',()=>{
  const html=renderToStaticMarkup(<GruposProspeccao grupos={[{...lista,nome:'<script>nome</script>',descricao:'Resumo da Mooca',origem:'Receita fictícia',criterios:'<b>Critério</b>\nOutro termo',disponiveis:0}]} pagina={2} temProxima />)
  expect(html).toContain('&lt;script&gt;nome&lt;/script&gt;')
  expect(html).not.toContain('<script>')
  expect(html).toContain('<summary>Critérios usados</summary>')
  expect(html).toContain('&lt;b&gt;Critério&lt;/b&gt;')
  expect(html).toContain('Nenhuma empresa disponível para nova reserva nesta lista agora')
  expect(html).toContain('href="/fila?listas_pagina=3"')
  expect(html).toContain('A mesma empresa pode aparecer em mais de uma')
})
test('paginação contextual na busca preserva página de empresas e só a seleção limpa refinamentos',()=>{
  const filtros={nome:'Aurora',cnae:'1234567',uf:null,cidade:null,bairro:null,pagina:3,grupo:lista.id}
  const html=renderToStaticMarkup(<GruposProspeccao grupos={[lista]} pagina={2} temProxima escolha={{filtros,atendimento:false}} />)
  expect(html).toContain(`href="/fila/localizar?nome=Aurora&amp;cnae=1234567&amp;grupo=${lista.id}&amp;pagina=3&amp;escolher_lista=1&amp;listas_pagina=3"`)
  expect(html).toContain(`href="/fila/localizar?grupo=${lista.id}&amp;pagina=1"`)
  expect(html).toContain('href="/fila/localizar?pagina=1"')
})
test('página vazia permite voltar sem remover o contexto selecionado',()=>{
  const filtros={nome:'Aurora',cnae:null,uf:null,cidade:null,bairro:null,pagina:3,grupo:lista.id}
  const html=renderToStaticMarkup(<GruposProspeccao grupos={[]} pagina={2} temProxima={false} escolha={{filtros,atendimento:true}} />)
  expect(html).toContain('Nenhuma lista nesta página')
  expect(html).toContain(`href="/fila?nome=Aurora&amp;grupo=${lista.id}&amp;pagina=3&amp;escolher_lista=1&amp;listas_pagina=1"`)
  expect(html).not.toContain('Próxima página de listas')
})
