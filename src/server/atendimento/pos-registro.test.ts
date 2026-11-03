
import { beforeEach, expect, test, vi } from 'vitest'
const ler=vi.hoisted(()=>vi.fn())
vi.mock('./consulta',()=>({lerResumosEmpresas:ler}))
import { lerDestinoContato, lerDestinoEmpresaAtual } from './pos-registro'
beforeEach(()=>vi.resetAllMocks())
function atual(situacao:string,negociacaoId:string|null=null){ler.mockResolvedValue({ok:true,empresas:[{id:'E',situacao,negociacaoId}]})}
test.each(['interessado','retornar_depois'] as const)('%s abre somente negociação ativa atual autorizada',async(tipo)=>{
  atual('primeiro_contato','atual')
  expect(await lerDestinoContato('eu','E',tipo)).toEqual({ok:true,destino:{tipo:'funil',negociacaoId:'atual'}})
  expect(ler).toHaveBeenCalledWith('eu',['E'])
  atual('cliente','antiga')
  expect(await lerDestinoContato('eu','E',tipo)).toEqual({ok:true,destino:{tipo:'permanecer'}})
  atual('atendimento')
  expect(await lerDestinoContato('eu','E',tipo)).toEqual({ok:true,destino:{tipo:'permanecer'}})
})
test('replay arquivado vai ao recorte e retomado permanece sem ressuscitar negociação',async()=>{
  atual('sem_interesse','encerrada')
  expect(await lerDestinoContato('eu','E','interessado')).toEqual({ok:true,destino:{tipo:'sem_interesse'}})
  atual('atendimento','encerrada')
  expect(await lerDestinoContato('eu','E','interessado')).toEqual({ok:true,destino:{tipo:'permanecer'}})
  atual('em_negociacao','nova')
  expect(await lerDestinoContato('eu','E','nao_atendeu')).toEqual({ok:true,destino:{tipo:'permanecer'}})
})
test.each([
 ['atendimento',null,{tipo:'atendimento',empresaId:'E'}],
 ['cliente','antiga',{tipo:'carteira',empresaId:'E'}],
 ['em_negociacao','nova',{tipo:'funil',negociacaoId:'nova'}],
 ['sem_interesse',null,{tipo:'sem_interesse'}],
 ['indisponivel','antiga',{tipo:'indisponivel'}],
 ['arquivada','antiga',{tipo:'indisponivel'}],
] as const)('iniciar/retomar usa situação %s atual',async(situacao,id,destino)=>{
 atual(situacao,id)
 expect(await lerDestinoEmpresaAtual('eu','E')).toEqual({ok:true,destino})
})
test('leitura recusada, alvo ausente e infraestrutura não inventam destino',async()=>{
 for(const resposta of [{ok:false,motivo:'sem_permissao'},{ok:true,empresas:[]},{ok:true,empresas:[{id:'outro',situacao:'cliente'}]}]){
  ler.mockResolvedValueOnce(resposta)
  expect(await lerDestinoContato('eu','E','interessado')).toMatchObject({ok:false})
 }
 ler.mockRejectedValueOnce(new Error('rede'))
 expect(await lerDestinoEmpresaAtual('eu','E')).toMatchObject({ok:false})
})
