import { expect, test } from 'vitest'
import { criteriosVazios, normalizarCriterios, verificacoesNecessarias } from './criterios'

test('plano neutro e termos adicionais não acionam verificações', () => {
  expect(verificacoesNecessarias(criteriosVazios())).toEqual([])
  expect(verificacoesNecessarias({ ...criteriosVazios(), termos: 'lojas de bairro' })).toEqual([])
})
test('cada plano recebe suas próprias caixas de seleção', () => {
  const a = criteriosVazios()
  a.telefone.push('fixo')
  expect(criteriosVazios().telefone).toEqual([])
})
test('alternativas com e sem neutralizam o filtro', () => {
  const r = normalizarCriterios({ site: ['sem', 'com', 'sem'], email: ['com', 'sem'] })
  expect(r).toEqual({ ok: true, valor: criteriosVazios() })
})
test('seleciona as etapas necessárias sem repetir leitura de dados ou presença digital', () => {
  expect(verificacoesNecessarias({ ...criteriosVazios(), nota: 0, avaliacoes: 0, site: ['com'], email: ['com'], telefone: ['whatsapp', 'fixo'], produtos: 'tecidos' }))
    .toEqual(['dados_google', 'presenca_digital', 'perfil_comercial', 'whatsapp', 'fixo'])
})
test('prioridades ordenam sem exigir aprovação de filtro', () => {
  expect(verificacoesNecessarias({ ...criteriosVazios(), atendimento: 'priorizar_fisica', situacao: 'priorizar_funcionamento', prioridades: 'Mais avaliações' })).toEqual([])
})
test.each([0, 5])('preserva nota %s como número', nota => {
  expect(normalizarCriterios({ nota })).toEqual({ ok: true, valor: { ...criteriosVazios(), nota } })
})
test.each([{ nota: -1 }, { nota: 5.1 }, { nota: '4' }, { avaliacoes: -1 }, { avaliacoes: 1.5 }, { site: ['talvez'] }, { telefone: 'fixo' }, { teste: true }, { termos: 'a'.repeat(2001) }, { produtos: 'a\u0000b' }])('rejeita critério inválido: %j', entrada => {
  expect(normalizarCriterios(entrada)).toMatchObject({ ok: false })
})
test('ordem das caixas é canônica e normalização não altera a entrada', () => {
  const entrada = { telefone: ['fixo', 'whatsapp', 'fixo'], termos: '  brinquedos  ' }
  expect(normalizarCriterios(entrada)).toEqual({ ok: true, valor: { ...criteriosVazios(), telefone: ['whatsapp', 'fixo'], termos: 'brinquedos' } })
  expect(entrada.telefone).toHaveLength(3)
})
test('lê ausência de critérios e texto legado sem perder orientações', () => {
  expect(normalizarCriterios(undefined)).toEqual({ ok: true, valor: criteriosVazios() })
  expect(normalizarCriterios('Perto do centro')).toEqual({ ok: true, valor: { ...criteriosVazios(), observacoes: 'Perto do centro' } })
})
