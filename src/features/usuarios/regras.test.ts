import { describe, expect, test } from 'vitest'
import { acoesDe, gestorUnico, validarNovoUsuario, type Usuario } from './regras'

const u = (parte: Partial<Usuario>): Usuario => ({
  id: 'u1',
  nome: 'Alguém',
  email: 'alguem@teste.local',
  papel: 'vendedor',
  ativo: true,
  senhaProvisoriaPendente: false,
  ...parte,
})

describe('acoesDe', () => {
  test('a própria linha não oferece nada', () => {
    expect(acoesDe(u({ id: 'eu' }), 'eu')).toEqual([])
  })
  test('ativo: nova senha, mudar papel, desativar', () => {
    expect(acoesDe(u({}), 'eu')).toEqual(['nova_senha', 'mudar_papel', 'desativar'])
  })
  test('inativo: só reativar', () => {
    expect(acoesDe(u({ ativo: false }), 'eu')).toEqual(['reativar'])
  })
})

describe('gestorUnico', () => {
  test('zero gestores: falso', () => {
    expect(gestorUnico([u({})])).toBe(false)
  })
  test('um gestor ativo: verdadeiro', () => {
    expect(gestorUnico([u({ papel: 'gestor' }), u({ id: 'u2' })])).toBe(true)
  })
  test('dois gestores ativos: falso', () => {
    expect(gestorUnico([u({ papel: 'gestor' }), u({ id: 'u2', papel: 'gestor' })])).toBe(false)
  })
  test('gestor inativo não conta', () => {
    expect(gestorUnico([u({ papel: 'gestor' }), u({ id: 'u2', papel: 'gestor', ativo: false })])).toBe(true)
  })
})

describe('validarNovoUsuario', () => {
  test('normaliza nome e e-mail', () => {
    expect(validarNovoUsuario({ nome: '  Ana ', email: ' Ana@Teste.local ', papel: 'vendedor' })).toEqual({
      ok: true,
      dados: { nome: 'Ana', email: 'ana@teste.local', papel: 'vendedor' },
    })
  })
  test('todas as faltas de uma vez', () => {
    expect(validarNovoUsuario({ nome: '  ', email: 'sem-arroba', papel: 'chefe' })).toEqual({
      ok: false,
      faltas: ['nome_vazio', 'email_invalido', 'papel_invalido'],
    })
  })
  test('gestor é papel válido', () => {
    expect(validarNovoUsuario({ nome: 'B', email: 'b@t.local', papel: 'gestor' })).toMatchObject({ ok: true })
  })
})
