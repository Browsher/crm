import { expect, test, vi } from 'vitest'
import { atualizarMetadadosGrupo, detalharGrupo, paginaGrupos, renomearGrupo } from './grupos'
import { comoUsuario } from '../../server/db/como-usuario'
vi.mock('../../server/db/como-usuario', () => ({ comoUsuario: vi.fn() }))

test.each([undefined, [], '0', '-1', '1.5', 'Infinity', '1000001'])('paginação malformada %s recupera primeira página', valor => {
  expect(paginaGrupos(valor)).toBe(1)
})
test('página válida mantém navegação', () => { expect(paginaGrupos('23')).toBe(23) })
test('id malformado nunca chega ao banco', async () => {
  expect(await detalharGrupo('gestor', 'qualquer coisa')).toEqual({ ok: false, motivo: 'nao_encontrado' })
  expect(comoUsuario).not.toHaveBeenCalled()
})
test.each([' ', 'x'.repeat(101), 'nome\nnovo'])('nome inválido não envia mutação: %j', async nome => {
  expect(await renomearGrupo('gestor', 'id', nome)).toEqual({ ok: false, motivo: 'nome_invalido' })
  expect(comoUsuario).not.toHaveBeenCalled()
})


test('correção usa função definidora com contexto normalizado e quatro argumentos', async () => {
  const executar = vi.fn().mockResolvedValue({ linhas: [{ resultado: 'ok' }] })
  vi.mocked(comoUsuario).mockImplementation(async (_id, trabalho) => trabalho(executar))
  const id = '11111111-1111-4111-8111-111111111111'
  expect(await atualizarMetadadosGrupo('gestor', id, { descricao: ' Mooca\r\nCFTV ', origem: ' Google Maps ', criterios: '' })).toEqual({ ok: true })
  expect(executar).toHaveBeenCalledWith('SELECT public.grupo_importacao_metadados_definir($1,$2,$3,$4) AS resultado', [id, 'Mooca\nCFTV', 'Google Maps', null])
})
test.each([['42501', 'sem_permissao'], ['22023', 'metadados_invalidos']])('correção traduz SQLSTATE %s', async (code, motivo) => {
  vi.mocked(comoUsuario).mockRejectedValue({ code })
  expect(await atualizarMetadadosGrupo('gestor', '11111111-1111-4111-8111-111111111111', { descricao: 'Mooca', origem: 'Google Maps', criterios: null })).toEqual({ ok: false, motivo })
})
test('correção inválida não toca o banco e UUID ausente é recuperável', async () => {
  vi.mocked(comoUsuario).mockClear()
  expect(await atualizarMetadadosGrupo('gestor', 'inválido', { descricao: 'Mooca', origem: 'Google Maps', criterios: null })).toEqual({ ok: false, motivo: 'nao_encontrado' })
  expect(await atualizarMetadadosGrupo('gestor', '11111111-1111-4111-8111-111111111111', { descricao: '', origem: 'Google Maps', criterios: null })).toEqual({ ok: false, motivo: 'metadados_invalidos' })
  expect(comoUsuario).not.toHaveBeenCalled()
})
