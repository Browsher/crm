import { beforeEach, expect, test, vi } from 'vitest'
const executar=vi.hoisted(()=>vi.fn())
vi.mock('../db/como-usuario',()=>({comoUsuario:async(_id:string,trabalho:(executar:unknown)=>unknown)=>trabalho(executar)}))
import { lerGrupoProspeccao, listarGruposProspeccao } from './prospeccao'
beforeEach(()=>vi.clearAllMocks())
test('leitor comercial traduz somente campos públicos e contagens numéricas',async()=>{
  executar.mockResolvedValue({linhas:[{id:'g',nome:'Lista',descricao:null,origem:'Fonte',criterios:null,criado_em:new Date('2026-10-13'),total:'2',disponiveis:'1',arquivo_nome:'privado.csv',assinatura:'segredo'}]})
  expect(await lerGrupoProspeccao('eu','g')).toEqual({ok:true,grupo:{id:'g',nome:'Lista',descricao:null,origem:'Fonte',criterios:null,criadoEm:'2026-10-13T00:00:00.000Z',total:2,disponiveis:1}})
  expect(executar).toHaveBeenCalledWith('SELECT * FROM public.grupo_prospeccao_ler($1)',['g'])
})
test('leitor vazio e recusa de leitura devolvem motivos próprios',async()=>{
  executar.mockResolvedValue({linhas:[]})
  expect(await lerGrupoProspeccao('eu','g')).toEqual({ok:false,motivo:'grupo_indisponivel'})
  executar.mockRejectedValue({code:'42501'})
  expect(await lerGrupoProspeccao('eu','g')).toEqual({ok:false,motivo:'sem_permissao'})
})
test('erro de infraestrutura continua visível',async()=>{
  executar.mockRejectedValue(new Error('conexão falhou'))
  await expect(lerGrupoProspeccao('eu','g')).rejects.toThrow('conexão falhou')
})

test('catálogo corta a vigésima primeira linha e traduz exclusivamente DTO público',async()=>{
  const linha={id:'g',nome:'Lista',descricao:null,origem:'Fonte',criterios:null,criado_em:new Date('2026-10-13'),total:'2',disponiveis:'1',arquivo_nome:'privado.csv',pedido:{segredo:true},assinatura:'privada',criado_por:'admin'}
  executar.mockResolvedValue({linhas:Array.from({length:21},(_,i)=>({...linha,id:String(i)}))})
  const r=await listarGruposProspeccao('eu',2)
  expect(r).toMatchObject({ok:true,temProxima:true})
  if(!r.ok) throw new Error('Leitura recusada')
  expect(r.grupos).toHaveLength(20)
  expect(r.grupos[0]).toEqual({id:'0',nome:'Lista',descricao:null,origem:'Fonte',criterios:null,criadoEm:'2026-10-13T00:00:00.000Z',total:2,disponiveis:1})
  expect(executar).toHaveBeenCalledWith(expect.stringContaining('public.grupos_prospeccao_listar($1)'),[2])
})
test('catálogo vazio é explícito e permissão negada não vira resultado vazio',async()=>{
  executar.mockResolvedValue({linhas:[]})
  expect(await listarGruposProspeccao('eu')).toEqual({ok:true,grupos:[],temProxima:false})
  executar.mockRejectedValue({code:'42501'})
  expect(await listarGruposProspeccao('eu')).toEqual({ok:false,motivo:'sem_permissao'})
  executar.mockRejectedValue(new Error('conexão falhou'))
  await expect(listarGruposProspeccao('eu')).rejects.toThrow('conexão falhou')
})
test('catálogo recusa página não inteira ou fora da faixa antes do banco',async()=>{
  for(const pagina of [0,-1,1.5,NaN,Infinity,10001]) await expect(listarGruposProspeccao('eu',pagina)).rejects.toThrow('Página de listas inválida')
  expect(executar).not.toHaveBeenCalled()
})
test('catálogo identifica empresas de origem Google nas listas compartilhadas anteriores', async () => {
  executar.mockResolvedValue({ linhas: [{ id: 'legado', nome: 'Lista anterior', criado_em: '2026-10-01', total: '1', disponiveis: '1', google_legado: true }] })
  const r = await listarGruposProspeccao('eu')
  expect(r).toMatchObject({ ok: true, grupos: [{ id: 'legado', googleLegado: true }] })
})
