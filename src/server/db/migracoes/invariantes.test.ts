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
    { schema: 'public', nome: 'fila_puxar', temSearchPath: true },
    { schema: 'public', nome: 'empresa_assumir', temSearchPath: true },
    { schema: 'public', nome: 'empresa_devolver', temSearchPath: true },
  ],
  funcoesDeAcesso: [
    'public.usuario_atual', 'public.pode_ler', 'public.eh_gestor',
    'public.pode_escrever', 'public.senha_provisoria_de',
  ],
  papeis: ['app_conexao', 'app_usuario'],
  conexao: { rolsuper: false, rolbypassrls: false, rolconnlimit: 20, dona: 0, herdaDe: [] },
  migracaoAlcancavelPor: [],
  privilegiosDeConexaoEmAutenticacao: [],
  politicasEmAutenticacao: [],
  politicasIrrestritas: ['public.cep.cep_leitura'],
  funcoesConcedidasAAppUsuario: [
    'public.credencial_definir', 'public.eh_gestor', 'public.pode_escrever', 'public.pode_ler',
    'public.senha_provisoria_de', 'public.usuario_atual', 'public.usuario_situacao_definir',
    'public.fila_puxar', 'public.empresa_assumir', 'public.empresa_devolver',
    'public.contato_registrar',
  ],
  funcoesExecutaveisPorPublico: [],
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
    e.funcoesDeAcesso = e.funcoesDeAcesso.filter((n) => n !== 'public.pode_ler')
    umaViolacao(e, /função de acesso ausente: public\.pode_ler/)
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
    e.funcoesDeAcesso = e.funcoesDeAcesso.filter((n) => n !== 'public.pode_escrever')
    umaViolacao(e, /função de acesso ausente: public\.pode_escrever/)
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

  test('definidora concedida a app_usuario fora da lista, mesmo sem tocar autenticacao', () => {
    const e = sao()
    e.funcoesConcedidasAAppUsuario.push('public.atalho')
    umaViolacao(e, /concedida a app_usuario e não registrada: public\.atalho/)
  })

  test('definidora concedida em outro schema também é acusada', () => {
    const e = sao()
    e.funcoesConcedidasAAppUsuario.push('relatorios.espia')
    umaViolacao(e, /concedida a app_usuario e não registrada: relatorios\.espia/)
  })

  test('função registrada ausente ou sem GRANT é violação, não verde', () => {
    const e = sao()
    e.funcoesConcedidasAAppUsuario = e.funcoesConcedidasAAppUsuario.filter((n) => n !== 'public.eh_gestor')
    umaViolacao(e, /registrada e ausente ou sem GRANT: public\.eh_gestor/)
  })

  test('função de schema de aplicação executável por PUBLIC', () => {
    const e = sao()
    e.funcoesExecutaveisPorPublico = ['public.definir_auditoria']
    umaViolacao(e, /executável por PUBLIC: public\.definir_auditoria/)
  })
})

describe('políticas de leitura irrestrita', () => {
  test('política com USING (true) fora da lista é acusada', () => {
    const e = sao()
    // push, não substituição: tirar a registrada produziria uma segunda
    // violação ("registrada e ausente") e o teste deixaria de isolar uma coisa.
    e.politicasIrrestritas.push('public.pedido.pedido_ler')
    umaViolacao(e, /leitura irrestrita não registrada: public\.pedido\.pedido_ler/)
  })

  test('a política registrada não é violação', () => {
    expect(avaliar(sao())).toEqual([])
  })

  test('política registrada que sumiu do banco é acusada', () => {
    const e = sao()
    e.politicasIrrestritas = []
    umaViolacao(e, /leitura irrestrita registrada e ausente: public\.cep\.cep_leitura/)
  })
})
