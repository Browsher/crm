import { expect, test } from 'vitest'
import { aplicarSugestaoAoPlano } from './assistente-ia'
import { criteriosVazios } from './criterios'

const plano = {
  dia: '2026-10-23', nicho: 'Comércio', cidade: 'Santos', uf: 'SP', bairro: 'Centro',
  criterios: { ...criteriosVazios(), termos: 'cabos', produtos: 'conectores', telefone: ['fixo'] as ['fixo'] },
}
const sugestao = { titulo: 'Instaladores', descricao: 'Usam câmeras.', nicho: 'Instalação de câmeras' }

test('campos ausentes ou vazios mantêm os dados do rascunho', () => {
  const campos = aplicarSugestaoAoPlano(plano, { ...sugestao, produtos: '  ' })
  expect(campos).toEqual({ nicho: sugestao.nicho, criterios: plano.criterios })
  expect(campos.criterios).not.toBe(plano.criterios)
})

test('uma região sugerida sem bairro aplica a cidade inteira', () => {
  expect(aplicarSugestaoAoPlano(plano, sugestao, [{ cidade: 'Campinas', estado: 'SP', bairros: [] }]))
    .toMatchObject({ cidade: 'Campinas', uf: 'SP', bairro: '' })
})

test('aplicar uma localização removida limpa os campos da região do dia', () => {
  expect(aplicarSugestaoAoPlano(plano, sugestao, [])).toMatchObject({ cidade: '', uf: '', bairro: '' })
})
