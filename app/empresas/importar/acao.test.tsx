// .tsx mantém este teste no projeto unitário, conforme o include do Vitest.
import { beforeEach, describe, expect, test, vi } from 'vitest'

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
const INICIAL = { erro: null, relatorio: null, inseridas: null }

function formCom(arquivo: File, confirmar = false) {
  const form = new FormData()
  form.set('arquivo', arquivo)
  if (confirmar) form.set('confirmar', '1')
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
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

  test('formato desconhecido volta como erro recuperavel', async () => {
    const resultado = await importarAcao(INICIAL, formCom(new File(['pdf'], 'empresas.pdf', { type: 'application/pdf' })))
    expect(resultado.erro).toContain('Excel')
    expect(resultado.erro).toContain('CSV')
    expect(dependencias.analisar).not.toHaveBeenCalled()
  })

  test('conferencia envia formato e bytes ao servico', async () => {
    dependencias.analisar.mockResolvedValue({
      ok: true,
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
      inseridas: 1,
    })
    const arquivo = new File(['csv'], 'empresas.csv', { type: 'text/csv' })

    const resultado = await importarAcao(INICIAL, formCom(arquivo, true))

    expect(dependencias.importar).toHaveBeenCalledWith(
      { nome: 'repo' },
      { formato: 'csv', bytes: new TextEncoder().encode('csv') },
    )
    expect(dependencias.analisar).not.toHaveBeenCalled()
    expect(resultado.inseridas).toBe(1)
  })
})
