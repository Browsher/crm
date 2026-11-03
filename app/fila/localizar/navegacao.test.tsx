import { expect, test } from 'vitest'
import { selecionarGrupo, urlConsulta, urlEscolhaLista, urlAtendimento, filtrosDaConsulta, lerConsultaPessoal } from './navegacao'
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
 test('ida e volta do arquivo conservam situação e todos os refinamentos',()=>{
  const f={disponibilidade:'sem_interesse',nome:'Aurora',cnpj:'12345678901234',nicho:'Luz',endereco:'Centro',pagina:'3'}
  const atual=filtrosDaConsulta({origem:'sem_interesse',nome:f.nome,cnpj:f.cnpj,nicho:f.nicho,endereco:f.endereco,pagina:f.pagina})
  expect(atual).toEqual(f)
  const ida=urlAtendimento('empresa',atual)
  expect(new URL(ida,'http://localhost').pathname).toBe('/fila/atendimento/empresa')
  expect(filtrosDaConsulta(Object.fromEntries(new URL(ida,'http://localhost').searchParams))).toEqual(f)
 })

test.each([{disponibilidade:'invalida'},{disponibilidade:['sem_interesse','sem_interesse']}])('recorte forçado valida disponibilidade fornecida %j antes de impor Sem interesse',({disponibilidade})=>{
 expect(lerConsultaPessoal({disponibilidade},true)).toEqual({ok:false})
 expect(lerConsultaPessoal({origem:'sem_interesse',disponibilidade})).toEqual({ok:false})
 expect(lerConsultaPessoal({pessoal:JSON.stringify({origem:'sem_interesse',disponibilidade})})).toEqual({ok:false})
})
test('recorte Sem interesse continua normalizando uma disponibilidade válida fornecida',()=>{
 expect(lerConsultaPessoal({origem:'sem_interesse',disponibilidade:'comigo'})).toEqual({ok:true,filtros:{disponibilidade:'sem_interesse'}})
 expect(lerConsultaPessoal({disponibilidade:'disponivel'},true)).toEqual({ok:true,filtros:{disponibilidade:'sem_interesse'}})
})
