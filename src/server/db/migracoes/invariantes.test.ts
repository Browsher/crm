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
    { schema: 'public', nome: 'pode_escrever', temSearchPath: true },
    { schema: 'public', nome: 'senha_provisoria_de', temSearchPath: true },
    { schema: 'public', nome: 'credencial_definir', temSearchPath: true },
    { schema: 'public', nome: 'sessoes_encerrar_de', temSearchPath: true },
    { schema: 'public', nome: 'usuario_situacao_definir', temSearchPath: true },
  ],
  funcoesDeAcesso: ['usuario_atual', 'pode_ler', 'eh_gestor', 'pode_escrever', 'senha_provisoria_de'],
  papeis: ['app_conexao', 'app_usuario'],
  conexao: { rolsuper: false, rolbypassrls: false, rolconnlimit: 20, dona: 0, herdaDe: [] },
  migracaoAlcancavelPor: [],
  privilegiosDeConexaoEmAutenticacao: [],
  politicasEmAutenticacao: [],
  funcoesDeUsuarioEmAutenticacao: [{ nome: 'credencial_definir', executaAppUsuario: true }],
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

  test('tabela com FORCE: a mensagem diz o efeito real, bloqueio, não recursão', () => {
    const e = sao()
    e.tabelas[1].force = true
    umaViolacao(e, /FORCE.*public\.usuario.*bloqueio/)
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
    e.funcoesDeAcesso = ['usuario_atual', 'eh_gestor', 'pode_escrever', 'senha_provisoria_de']
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

  test('pode_escrever ausente é violação', () => {
    const e = sao()
    e.funcoesDeAcesso = ['usuario_atual', 'pode_ler', 'eh_gestor', 'senha_provisoria_de']
    umaViolacao(e, /função de acesso ausente: pode_escrever/)
  })

  test('app_conexao com privilégio de tabela em autenticacao', () => {
    const e = sao()
    e.privilegiosDeConexaoEmAutenticacao = ['sessao']
    umaViolacao(e, /app_conexao alcança autenticacao\.sessao/)
  })

  test('política em tabela de autenticacao', () => {
    const e = sao()
    e.politicasEmAutenticacao = ['sessao_ler']
    umaViolacao(e, /política em autenticacao: sessao_ler/)
  })

  test('_migracao alcançável por papel da aplicação', () => {
    const e = sao()
    e.migracaoAlcancavelPor = ['app_usuario']
    umaViolacao(e, /_migracao alcançável por app_usuario/)
  })

  test('função definidora de public tocando autenticacao com EXECUTE para app_usuario fora da lista', () => {
    const e = sao()
    e.funcoesDeUsuarioEmAutenticacao.push({ nome: 'intrusa', executaAppUsuario: true })
    umaViolacao(e, /não está registrada: intrusa/)
  })

  test('função tocando autenticacao sem EXECUTE para app_usuario e fora da lista não é violação', () => {
    const e = sao()
    e.funcoesDeUsuarioEmAutenticacao.push({ nome: 'interna', executaAppUsuario: false })
    expect(avaliar(e)).toEqual([])
  })

  test('função registrada ausente é violação, não verde', () => {
    const e = sao()
    e.funcoesDeUsuarioEmAutenticacao = []
    umaViolacao(e, /ausente ou sem EXECUTE para app_usuario: credencial_definir/)
  })

  test('função registrada sem EXECUTE é violação', () => {
    const e = sao()
    e.funcoesDeUsuarioEmAutenticacao[0].executaAppUsuario = false
    umaViolacao(e, /ausente ou sem EXECUTE para app_usuario: credencial_definir/)
  })
})
