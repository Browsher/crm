import { beforeEach, expect, test, vi } from 'vitest'
const executar=vi.hoisted(()=>vi.fn())
vi.mock('../db/como-usuario',()=>({comoUsuario:async(_id:string,trabalho:(executar:unknown)=>unknown)=>trabalho(executar)}))
import { lerGrupoProspeccao } from './prospeccao'
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
