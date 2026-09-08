import { describe, expect, test } from 'vitest'
import { avaliar, type Estado } from './invariantes'

// Estado que passa em tudo. Cada teste muda uma coisa e espera uma violação.
const sao = (): Estado => ({
  tabelas: [
    { schema: 'public', nome: '_migracao', rls: false, force: false },
    { schema: 'public', nome: 'usuario', rls: true, force: false },
  ],
  funcoesDefinidoras: [
    { schema: 'public', nome: 'usuario_atual', temSearchPath: true },
    { schema: 'public', nome: 'pode_ler', temSearchPath: true },
    { schema: 'public', nome: 'eh_gestor', temSearchPath: true },
  ],
  funcoesDeAcesso: ['usuario_atual', 'pode_ler', 'eh_gestor'],
  papeis: ['app_conexao', 'app_usuario'],
  conexao: { rolsuper: false, rolbypassrls: false, rolconnlimit: 20, dona: 0, herdaDe: [] },
  migracaoAlcancavelPor: [],
})

const umaViolacao = (estado: Estado, padrao: RegExp) => {
  const v = avaliar(estado)
  expect(v).toHaveLength(1)
  expect(v[0]).toMatch(padrao)
}

describe('avaliar', () => {
  test('estado são não tem violação', () => {
    expect(avaliar(sao())).toEqual([])
  })

  test('tabela sem RLS em qualquer schema de aplicação, exceto _migracao', () => {
    const e = sao()
    e.tabelas.push({ schema: 'autenticacao', nome: 'credencial', rls: false, force: false })
    umaViolacao(e, /sem RLS: autenticacao\.credencial/)
  })

  test('tabela com FORCE', () => {
    const e = sao()
    e.tabelas[1].force = true
    umaViolacao(e, /FORCE.*public\.usuario/)
  })

  test('função SECURITY DEFINER sem search_path, em qualquer schema', () => {
    const e = sao()
    e.funcoesDefinidoras.push({ schema: 'autenticacao', nome: 'sessao_atual', temSearchPath: false })
    umaViolacao(e, /autenticacao\.sessao_atual sem search_path/)
  })

  test('papel da aplicação ausente é violação, não verde', () => {
    const e = sao()
    e.papeis = ['app_conexao']
    umaViolacao(e, /papel ausente: app_usuario/)
  })

  test('app_conexao ausente é violação única', () => {
    const e = sao()
    e.papeis = ['app_usuario']
    e.conexao = null
    umaViolacao(e, /papel ausente: app_conexao/)
  })

  test('função de acesso ausente é violação, não verde', () => {
    const e = sao()
    e.funcoesDeAcesso = ['usuario_atual', 'eh_gestor']
    umaViolacao(e, /função de acesso ausente: pode_ler/)
  })

  test.each([
    ['superusuário', { rolsuper: true }, /superusuário/],
    ['BYPASSRLS', { rolbypassrls: true }, /BYPASSRLS/],
    ['dona de tabela', { dona: 1 }, /dona de tabela/],
    ['sem CONNECTION LIMIT', { rolconnlimit: -1 }, /CONNECTION LIMIT/],
    ['herdando privilégio', { herdaDe: ['app_usuario'] }, /herda privilégios de app_usuario/],
  ])('app_conexao %s', (_, mudanca, padrao) => {
    const e = sao()
    e.conexao = { ...e.conexao!, ...mudanca }
    umaViolacao(e, padrao)
  })

  test('_migracao alcançável por papel da aplicação', () => {
    const e = sao()
    e.migracaoAlcancavelPor = ['app_usuario']
    umaViolacao(e, /_migracao alcançável por app_usuario/)
  })
})
