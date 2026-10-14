import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { LinhaAceita } from './planilha'
import type { OperacaoGrupo } from './repositorio'
import type { Relatorio } from './servico'

const dependencias = vi.hoisted(() => ({
  comoUsuario: vi.fn(),
  executar: vi.fn(),
}))

vi.mock('../../server/db/como-usuario', () => ({ comoUsuario: dependencias.comoUsuario }))

const { repositorioPostgres } = await import('./repositorio')

const operacao: OperacaoGrupo = {
  chave: '11111111-1111-4111-8111-111111111111',
  nome: 'Mooca',
  arquivoNome: 'mooca.csv',
  metadados: { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null }, assinatura: 'a'.repeat(64),
}
const linha: LinhaAceita = {
  linha: 2,
  googlePlaceId: null,
  cnpj: '11222333000181',
  razaoSocial: 'Aurora Comércio LTDA',
  nomeFantasia: null,
  contatoNome: null,
  telefone: '11987654321',
  email: null,
  cep: '01310100',
  cnaePrincipal: '4742300',
}
const relatorio: Relatorio = {
  novas: 1,
  jaCadastradas: 0,
  recusadas: [],
  cepsPedidos: 1,
  cepsNaoEncontrados: 0,
  basePublicadaEm: '2024-07-08',
}

beforeEach(() => {
  vi.clearAllMocks()
  dependencias.comoUsuario.mockImplementation(async (_usuario, trabalho) => trabalho(dependencias.executar))
})

describe('repositorioPostgres.gravar', () => {
  test('confirma o grupo com todas as linhas e devolve o relatorio persistido pelo banco', async () => {
    const persistido = { ...relatorio, novas: 0, jaCadastradas: 1 }
    dependencias.executar.mockResolvedValue({
      linhas: [{
        grupo_id: '77777777-7777-4777-8777-777777777777',
        inseridas: 1,
        vinculadas: 1,
        relatorio: persistido,
      }],
      afetadas: 1,
    })

    const resultado = await repositorioPostgres('gestor-1').gravar(operacao, [linha], relatorio)

    expect(resultado).toEqual({
      ok: true,
      grupoId: '77777777-7777-4777-8777-777777777777',
      inseridas: 1,
      vinculadas: 1,
      relatorio: persistido,
    })
    const [sql, parametros] = dependencias.executar.mock.calls[0]
    expect(sql).toContain('grupo_importacao_confirmar')
    expect(parametros).toEqual([
      operacao.chave,
      operacao.nome,
      operacao.arquivoNome,
      operacao.assinatura,
      JSON.stringify([{
        cnpj: '11222333000181',
        google_place_id: null,
        razao_social: 'Aurora Comércio LTDA',
        nome_fantasia: null,
        contato_nome: null,
        telefone: '11987654321',
        email: null,
        cep: '01310100',
        cnae_principal: '4742300',
      }]),
      JSON.stringify(relatorio),
      JSON.stringify(operacao.metadados),
    ])
  })

  test('traduz 22023 em falha recuperavel', async () => {
    dependencias.comoUsuario.mockRejectedValue({ code: '22023' })
    await expect(repositorioPostgres('gestor-1').gravar(operacao, [linha], relatorio)).resolves.toEqual({
      ok: false,
      motivo: 'confirmacao_invalida',
    })
  })

  test('propaga falha de infraestrutura', async () => {
    dependencias.comoUsuario.mockRejectedValue(new Error('conexao caiu'))
    await expect(repositorioPostgres('gestor-1').gravar(operacao, [linha], relatorio)).rejects.toThrow('conexao caiu')
  })
})


describe('repositorioPostgres.preparar', () => {
  test('consulta identificadores não nulos separados e devolve os dois mapas', async () => {
    const cadastro = { id: 'empresa-a', cnpj: '11222333000181', razaoSocial: 'Aurora LTDA' }
    dependencias.executar.mockImplementation(async (sql: string) => {
      if (sql.includes('empresa_origem_google')) return { linhas: [{ id: 'empresa-b', cnpj: null, razaoSocial: null, google_place_id: 'ChIJ-ficticio' }] }
      if (sql.includes('FROM empresa WHERE')) return { linhas: [cadastro] }
      return { linhas: [] }
    })
    const r = await repositorioPostgres('gestor-1').preparar([
      { ...linha, googlePlaceId: null }, { ...linha, cnpj: null, razaoSocial: null, googlePlaceId: 'ChIJ-ficticio' },
    ], [])
    if ('motivo' in r) throw new Error(r.motivo)
    expect(r.porCnpj.get('11222333000181')).toEqual(cadastro)
    expect(r.porGoogle.get('ChIJ-ficticio')).toEqual({ id: 'empresa-b', cnpj: null, razaoSocial: null })
    const consultas = dependencias.executar.mock.calls.filter(([sql]) => sql.includes('ANY'))
    expect(consultas.map(([, parametros]) => parametros)).toEqual([[['11222333000181']], [['ChIJ-ficticio']]])
  })
  test('identificadores ausentes não geram consulta de empresa', async () => {
    dependencias.executar.mockResolvedValue({ linhas: [] })
    const r = await repositorioPostgres('gestor-1').preparar([], [])
    if ('motivo' in r) throw new Error(r.motivo)
    expect(r.porCnpj.size).toBe(0)
    expect(r.porGoogle.size).toBe(0)
    expect(dependencias.executar.mock.calls.some(([sql]) => sql.includes('ANY'))).toBe(false)
  })
})
