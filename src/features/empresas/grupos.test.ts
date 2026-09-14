import { expect, test, vi } from 'vitest'
import { detalharGrupo, paginaGrupos, renomearGrupo } from './grupos'
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
test.each([' ', 'x'.repeat(101), 'nome\nnovo'])('nome inválido não envia mutação: %s', async nome => {
  expect(await renomearGrupo('gestor', 'id', nome)).toEqual({ ok: false, motivo: 'nome_invalido' })
  expect(comoUsuario).not.toHaveBeenCalled()
})
