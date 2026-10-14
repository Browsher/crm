// .tsx mantém este teste no projeto unitário, conforme o include do Vitest.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const dependencias = vi.hoisted(() => ({
  exigir: vi.fn(),
  repositorioPostgres: vi.fn(),
  analisar: vi.fn(),
  importar: vi.fn(),
}))

vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: dependencias.exigir }))
vi.mock('@/src/features/empresas/repositorio', () => ({ repositorioPostgres: dependencias.repositorioPostgres }))
vi.mock('@/src/features/empresas/servico', () => ({
  analisar: dependencias.analisar,
  importar: dependencias.importar,
}))

const { importarAcao } = await import('./acao')
const INICIAL = { erro: null, relatorio: null, inseridas: null, grupoId: null, conferencia: null }
const CHAVE = '11111111-1111-4111-8111-111111111111'

function formCom(arquivo: File, confirmar = false, dados: { nome?: string; chave?: string } = {}) {
  const form = new FormData()
  form.set('arquivo', arquivo)
  form.set('nome', dados.nome ?? 'Mooca')
  form.set('chave', dados.chave ?? CHAVE)
  form.set('descricao', 'Mooca CFTV')
  form.set('origem', 'Google Maps')
  form.set('criterios', '')
  form.set('assinatura', 'hash-enviado-pelo-navegador-nao-e-confiavel')
  if (confirmar) form.set('confirmar', '1')
  return form
}

afterEach(() => vi.unstubAllEnvs())
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('IMPORTACAO_CONFERENCIA_SEGREDO', 'a'.repeat(64))
  dependencias.analisar.mockResolvedValue({ ok: true, relatorio: { novas: 1, jaCadastradas: 0, recusadas: [], cepsPedidos: 0, cepsNaoEncontrados: 0, basePublicadaEm: null }, conferencia: { linhasAceitas: [2], recusadasIdentidade: [] } })
  dependencias.exigir.mockResolvedValue({ usuarioId: 'gestor-1' })
  dependencias.repositorioPostgres.mockReturnValue({ nome: 'repo' })
})

describe('importarAcao: arquivo', () => {
  test('faz a guarda de gestor antes de ler o arquivo', async () => {
    const arquivo = new File(['conteudo'], 'empresas.xlsx')
    const ler = vi.spyOn(arquivo, 'arrayBuffer')
    dependencias.exigir.mockRejectedValue(new Error('sem sessao'))

    await expect(importarAcao(INICIAL, formCom(arquivo))).rejects.toThrow('sem sessao')
    expect(ler).not.toHaveBeenCalled()
  })

  test('tamanho acima do limite volta como erro recuperavel sem ler bytes', async () => {
    const arquivo = new File([new Uint8Array(1_500_001)], 'empresas.xlsx')
    const ler = vi.spyOn(arquivo, 'arrayBuffer')

    const resultado = await importarAcao(INICIAL, formCom(arquivo))

    expect(resultado).toMatchObject({ relatorio: null, inseridas: null })
    expect(resultado.erro).toContain('grande demais')
    expect(ler).not.toHaveBeenCalled()
    expect(dependencias.analisar).not.toHaveBeenCalled()
  })

  test.each([
    [{ nome: '   ' }, 'nome'],
    [{ chave: 'nao-e-uuid' }, 'operação'],
  ])('valida grupo e chave antes de ler bytes: %s', async (dados, trecho) => {
    const arquivo = new File(['conteudo'], 'empresas.csv')
    const ler = vi.spyOn(arquivo, 'arrayBuffer')

    const resultado = await importarAcao(INICIAL, formCom(arquivo, false, dados))

    expect(resultado.erro?.toLocaleLowerCase('pt-BR')).toContain(trecho)
    expect(ler).not.toHaveBeenCalled()
  })

  test('formato desconhecido volta como erro recuperavel', async () => {
    const resultado = await importarAcao(INICIAL, formCom(new File(['pdf'], 'empresas.pdf', { type: 'application/pdf' })))
    expect(resultado.erro).toContain('Excel')
    expect(resultado.erro).toContain('CSV')
    expect(dependencias.analisar).not.toHaveBeenCalled()
  })

  test('conferencia envia formato e bytes ao servico', async () => {
    dependencias.analisar.mockResolvedValue({
      ok: true,
      conferencia: { linhasAceitas: [], recusadasIdentidade: [] },
      relatorio: { novas: 0, jaCadastradas: 0, recusadas: [], cepsPedidos: 0, cepsNaoEncontrados: 0, basePublicadaEm: null },
    })
    const arquivo = new File([new Uint8Array([1, 2, 3])], 'EMPRESAS.XLSX')

    await importarAcao(INICIAL, formCom(arquivo))

    expect(dependencias.analisar).toHaveBeenCalledWith(
      { nome: 'repo' },
      { formato: 'xlsx', bytes: new Uint8Array([1, 2, 3]) },
    )
  })

  test('confirmacao chama importar com o arquivo original para reanalise', async () => {
    dependencias.importar.mockResolvedValue({
      ok: true,
      relatorio: { novas: 1, jaCadastradas: 0, recusadas: [], cepsPedidos: 0, cepsNaoEncontrados: 0, basePublicadaEm: null },
      grupoId: '77777777-7777-4777-8777-777777777777',
      inseridas: 1,
      vinculadas: 1,
    })
    const arquivo = new File(['csv'], 'empresas.csv', { type: 'text/csv' })

    const conferido = await importarAcao(INICIAL, formCom(arquivo))
    const form = formCom(arquivo, true)
    form.set('conferencia', conferido.conferencia!)
    dependencias.analisar.mockClear()
    const resultado = await importarAcao(INICIAL, form)

    expect(dependencias.importar).toHaveBeenCalledWith(
      { nome: 'repo' },
      { formato: 'csv', bytes: new TextEncoder().encode('csv') },
      {
        chave: CHAVE,
        nome: 'Mooca',
        arquivoNome: 'empresas.csv',
        metadados: { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null },
        assinatura: '53bb9b0b38ac812554abeb88ea6d56760d07ec147a75e8761c4f57ecc298218f',
      },
      { linhasAceitas: [2], recusadasIdentidade: [] },
    )
    expect(dependencias.analisar).not.toHaveBeenCalled()
    expect(resultado.inseridas).toBe(1)
    expect(resultado.grupoId).toBe('77777777-7777-4777-8777-777777777777')
  })

  test('22023 volta como erro recuperavel que exige nova conferencia', async () => {
    dependencias.importar.mockResolvedValue({ ok: false, motivo: 'confirmacao_invalida' })

    const arquivo = new File(['csv'], 'empresas.csv')
    const conferido = await importarAcao(INICIAL, formCom(arquivo))
    const form = formCom(arquivo, true)
    form.set('conferencia', conferido.conferencia!)
    const resultado = await importarAcao(INICIAL, form)

    expect(resultado).toMatchObject({ relatorio: null, inseridas: null, grupoId: null, conferencia: null })
    expect(resultado.erro).toContain('Confira o arquivo novamente')
  })
})


test('confirmação sem conferência autêntica não chama importar', async () => {
  dependencias.importar.mockResolvedValue({ ok: true, relatorio: { novas: 1, jaCadastradas: 0, recusadas: [], cepsPedidos: 0, cepsNaoEncontrados: 0, basePublicadaEm: null }, grupoId: 'grupo', inseridas: 1 })
  const arquivo = new File(['csv'], 'empresas.csv')
  const r = await importarAcao(INICIAL, formCom(arquivo, true))
  expect(r).toMatchObject({ erro: 'A confirmação mudou. Confira o arquivo novamente.', inseridas: null, grupoId: null, conferencia: null })
  expect(dependencias.importar).not.toHaveBeenCalled()
})


test.each(['arquivo', 'nome', 'chave', 'gestor', 'selecao'] as const)('protocolo recusa %s alterado após conferência sem chamar importar', async campo => {
  const arquivo = new File(['csv'], 'empresas.csv')
  const conferido = await importarAcao(INICIAL, formCom(arquivo))
  const form = formCom(arquivo, true)
  form.set('conferencia', conferido.conferencia!)
  if (campo === 'arquivo') form.set('arquivo', new File(['outros bytes'], 'empresas.csv'))
  if (campo === 'nome') form.set('nome', 'Centro')
  if (campo === 'chave') form.set('chave', '22222222-2222-4222-8222-222222222222')
  if (campo === 'gestor') dependencias.exigir.mockResolvedValue({ usuarioId: 'gestor-2' })
  if (campo === 'selecao') {
    const [payload, mac] = conferido.conferencia!.split('.')
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    dados.linhasAceitas = []
    form.set('conferencia', `${Buffer.from(JSON.stringify(dados)).toString('base64url')}.${mac}`)
  }
  const r = await importarAcao({ ...conferido, relatorio: { ...conferido.relatorio!, novas: 100 } }, form)
  expect(r).toMatchObject({ erro: 'A confirmação mudou. Confira o arquivo novamente.', inseridas: null, grupoId: null, conferencia: null })
  expect(dependencias.importar).not.toHaveBeenCalled()
})
test.each([['vazia', ''], ['inválida', 'invalido']])('configuração %s não autoriza confirmar nem revela segredo', async (_rotulo, segredo) => {
  vi.stubEnv('IMPORTACAO_CONFERENCIA_SEGREDO', segredo)
  const r = await importarAcao(INICIAL, formCom(new File(['csv'], 'empresas.csv')))
  expect(r).toMatchObject({ relatorio: null, conferencia: null, inseridas: null })
  expect(r.erro).toBe('Não foi possível concluir a conferência. Tente novamente mais tarde.')
  expect(dependencias.importar).not.toHaveBeenCalled()
})
test.each([[true, false], [false, false], [true, true]])('Action completa: lote misto=%s, recusa preexistente=%s', async (misto, preexistente) => {
  const real = await vi.importActual<typeof import('@/src/features/empresas/servico')>('@/src/features/empresas/servico')
  let conflito = preexistente
  const gravadas: unknown[] = []
  const repo: import('@/src/features/empresas/repositorio').RepositorioEmpresas = {
    async preparar() { return { porCnpj: new Map(), porGoogle: new Map(conflito ? [['ChIJ-conflito', { id: 'empresa-b', cnpj: '11444777000161', razaoSocial: 'Outra LTDA' }]] : []), enderecos: new Map(), basePublicadaEm: null } },
    async gravar(_op, linhas, relatorio) {
      if (linhas.some(l => l.googlePlaceId === 'ChIJ-conflito') && conflito) return { ok: false, motivo: 'confirmacao_invalida' }
      gravadas.push(linhas)
      return { ok: true, grupoId: 'grupo', inseridas: linhas.length, vinculadas: linhas.length, relatorio }
    },
  }
  dependencias.repositorioPostgres.mockReturnValue(repo)
  dependencias.analisar.mockImplementation(real.analisar)
  dependencias.importar.mockImplementation(real.importar)
  const arquivo = new File([
    ['cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal,google_place_id',
      '11222333000181,Aurora LTDA,,,11987654321,,,,ChIJ-conflito',
      ...(misto ? [',,Nova,,11987654321,,,,ChIJ-nova'] : []),
    ].join('\n'),
  ], 'empresas.csv')
  const conferido = await importarAcao(INICIAL, formCom(arquivo))
  expect(conferido.relatorio?.novas).toBe(preexistente ? 1 : misto ? 2 : 1)
  conflito = true
  const form = formCom(arquivo, true)
  form.set('conferencia', conferido.conferencia!)
  const r = await importarAcao(conferido, form)
  if (preexistente) {
    expect(r).toMatchObject({ erro: null, inseridas: 1, grupoId: 'grupo', relatorio: { novas: 1, recusadas: [{ tipo: 'identidade', linha: 2, motivo: 'cnpj_divergente' }] } })
    expect(gravadas).toHaveLength(1)
  } else {
    expect(r).toMatchObject({ erro: 'A confirmação mudou. Confira o arquivo novamente.', inseridas: null, grupoId: null })
    expect(gravadas).toEqual([])
  }
})

test('recusa resumo ausente antes de ler bytes', async () => {
  const arquivo = new File(['csv'], 'empresas.csv')
  const ler = vi.spyOn(arquivo, 'arrayBuffer')
  const form = formCom(arquivo)
  form.set('descricao', '')
  form.set('origem', 'Google Maps')
  const r = await importarAcao(INICIAL, form)
  expect(r.erro).toContain('Resumo')
  expect(ler).not.toHaveBeenCalled()
})

test('trocar somente origem invalida o comprovante emitido na conferência', async () => {
  const arquivo = new File(['csv'], 'empresas.csv')
  const form = formCom(arquivo)
  form.set('descricao', 'Mooca CFTV')
  form.set('origem', 'Google Maps')
  const r = await importarAcao(INICIAL, form)
  form.set('confirmar', '1')
  form.set('conferencia', r.conferencia!)
  form.set('origem', 'Outra coleta')
  dependencias.importar.mockResolvedValue({ ok: true, relatorio: r.relatorio, inseridas: 1, grupoId: 'grupo' })
  const confirmado = await importarAcao(INICIAL, form)
  expect(confirmado.erro).toBe('A confirmação mudou. Confira o arquivo novamente.')
  expect(dependencias.importar).not.toHaveBeenCalled()
})


test.each(['descricao', 'origem', 'criterios'] as const)('mudar só %s recusa confirmação sem gravar', async campo => {
  const arquivo = new File(['csv'], 'empresas.csv')
  const r = await importarAcao(INICIAL, formCom(arquivo))
  const form = formCom(arquivo, true)
  form.set('conferencia', r.conferencia!)
  form.set(campo, 'Outro contexto')
  expect((await importarAcao(INICIAL, form)).erro).toBe('A confirmação mudou. Confira o arquivo novamente.')
  expect(dependencias.importar).not.toHaveBeenCalled()
})
test('equivalência normalizada vincula os mesmos metadados na conferência e confirmação', async () => {
  const arquivo = new File(['csv'], 'empresas.csv')
  const form = formCom(arquivo)
  form.set('descricao', ' Mooca\r\nCFTV \r')
  form.set('origem', ' Google Maps ')
  form.set('criterios', '\r\n ')
  const r = await importarAcao(INICIAL, form)
  form.set('descricao', 'Mooca\nCFTV')
  form.set('origem', 'Google Maps')
  form.set('criterios', '')
  form.set('confirmar', '1')
  form.set('conferencia', r.conferencia!)
  dependencias.importar.mockResolvedValue({ ok: true, relatorio: r.relatorio, inseridas: 1, grupoId: 'grupo' })
  expect((await importarAcao(INICIAL, form)).erro).toBeNull()
  expect(dependencias.importar.mock.calls[0][2].metadados).toEqual({ descricao: 'Mooca\nCFTV', origem: 'Google Maps', criterios: null })
})
test('Action preserva emoji no limite 500/2000 e recusa limite excedido e controles antes de ler', async () => {
  const arquivo = new File(['csv'], 'empresas.csv')
  const form = formCom(arquivo)
  const ler = vi.spyOn(arquivo, 'arrayBuffer')
  form.set('descricao', '📷'.repeat(500))
  form.set('origem', '📷'.repeat(500))
  form.set('criterios', '📷'.repeat(2000))
  expect((await importarAcao(INICIAL, form)).erro).toBeNull()
  expect(ler).toHaveBeenCalledTimes(1)
  ler.mockClear()
  form.set('descricao', '📷'.repeat(501))
  expect((await importarAcao(INICIAL, form)).erro).toContain('Resumo')
  form.set('descricao', 'Mooca\u0001')
  expect((await importarAcao(INICIAL, form)).erro).toContain('Resumo')
  expect(ler).not.toHaveBeenCalled()
})
