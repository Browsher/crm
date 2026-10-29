import { expect, test } from 'vitest'
import { selecionarGrupo, urlConsulta, urlAtendimento } from '../localizar/navegacao'
test('consulta vazia e bookmark de grupo nunca reabrem uma lista compartilhada', () => {
  expect(urlConsulta(selecionarGrupo(null), 1)).not.toContain('grupo=')
  expect(urlConsulta({ ...selecionarGrupo('legado'), nome: 'Aurora' }, 2)).toBe('/fila/localizar?nome=Aurora&pagina=2')
})
test('atendimento explícito preserva filtros pessoais e paginação sem parâmetros legados', () => {
  const url = new URL(urlAtendimento('empresa', { origem: 'google', nicho: 'Luz & Cia', pagina: '3' }), 'https://crm.test')
  expect(url.pathname).toBe('/fila/atendimento/empresa')
  expect(Object.fromEntries(url.searchParams)).toEqual({ origem: 'google', nicho: 'Luz & Cia', pagina: '3' })
})
