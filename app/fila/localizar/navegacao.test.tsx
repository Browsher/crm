import { expect, test } from 'vitest'
import { limparFiltros, selecionarGrupo, urlConsulta } from './navegacao'

test('paginação conserva a lista selecionada', () => {
  const filtros = { nome:'Aurora', cnae:null, uf:'SP', cidade:null, bairro:null, pagina:3, grupo:'00000000-0000-4000-8000-000000000701' }
  const url = new URL(urlConsulta(filtros,4), 'https://crm.test')
  expect(url.searchParams.get('grupo')).toBe(filtros.grupo)
  expect(url.searchParams.get('pagina')).toBe('4')
})

test('limpar conserva somente a lista e selecionar reinicia os demais filtros', () => {
  const grupo='00000000-0000-4000-8000-000000000701'
  expect(limparFiltros({nome:'Luz',cnae:'1234567',uf:'SP',cidade:'3550308',bairro:'Centro',pagina:3,grupo})).toEqual({nome:'',cnae:null,uf:null,cidade:null,bairro:null,pagina:1,grupo})
  expect(selecionarGrupo(null)).toEqual({nome:'',cnae:null,uf:null,cidade:null,bairro:null,pagina:1,grupo:null})
})
