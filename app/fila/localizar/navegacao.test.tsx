import { expect, test } from 'vitest'
import { selecionarGrupo, urlConsulta, urlEscolhaLista, urlAtendimento, filtrosDaConsulta } from './navegacao'
test('aposenta grupo e escolha de lista mantendo refinamento e paginação',()=>{
  const f={...selecionarGrupo('grupo'),nome:'Luz & Cia',pagina:3}
  expect(urlConsulta(f,4)).toBe('/fila/localizar?nome=Luz+%26+Cia&pagina=4')
  expect(urlEscolhaLista(f,true)).toBe('/fila/localizar?nome=Luz+%26+Cia&pagina=3')
})
test('query antiga com filtros pessoais mantém origem, nicho e página',()=>{
  const f={origem:'google',nicho:'Luz',pagina:'2'}
  expect(filtrosDaConsulta({pessoal:JSON.stringify(f),grupo:'velho'})).toEqual(f)
  expect(urlAtendimento('empresa',f)).toBe('/fila/atendimento/empresa?origem=google&nicho=Luz&pagina=2')
})
test('JSON inválido, filtro alheio e destino externo não se propagam',()=>{
  expect(filtrosDaConsulta({pessoal:'{'})).toEqual({})
  expect(filtrosDaConsulta({pessoal:JSON.stringify({voltar:'//fora'})})).toEqual({})
  expect(urlConsulta(selecionarGrupo(null),1)).not.toContain('grupo=')
})