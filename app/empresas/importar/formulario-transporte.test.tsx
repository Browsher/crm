import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'
import { useActionState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { analisar } from '@/src/features/empresas/servico'
import { emitirConferencia } from '@/src/features/empresas/conferencia'
import { CABECALHO_GOOGLE } from '@/src/features/empresas/planilha'
import type { RepositorioEmpresas } from '@/src/features/empresas/repositorio'
import type { EstadoImportar } from './acao'

vi.mock('react', async original => {
  const real = await original<typeof import('react')>()
  return { ...real, useActionState: vi.fn(real.useActionState) }
})
vi.mock('./acao', () => ({ importarAcao: vi.fn() }))
const { importarAcao } = await import('./acao')
const { FormularioImportar } = await import('./formulario')
const require = createRequire(import.meta.url)
// A medição usa o mesmo serializador instalado da chamada direta do Next,
// com FormData/File reais de Node. Não estima overhead do multipart.
const { encodeReply } = require('next/dist/compiled/react-server-dom-webpack/client.node') as {
  encodeReply(args: unknown[]): Promise<FormData | string>
}
const inicial: EstadoImportar = { erro: null, relatorio: null, inseridas: null, grupoId: null, conferencia: null }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(importarAcao).mockResolvedValue(inicial)
})

test('argumentos reais do wrapper cabem em 2 MiB sem reenviar relatório de 4.999 recusas', async () => {
  const rows = Array.from({ length: 5000 }, (_, i) => `,Divergente,${'N'.repeat(248)},,11987654321,,,,ChIJ-${i}`)
  const fonte = new TextEncoder().encode([CABECALHO_GOOGLE, ...rows].join('\n'))
  expect(fonte.byteLength).toBeLessThan(1_500_000)
  const porGoogle = new Map(Array.from({ length: 4999 }, (_, i) => [`ChIJ-${i}`, { id: `empresa-${i}`, cnpj: null, razaoSocial: 'Original' }]))
  const repo: RepositorioEmpresas = {
    async preparar() { return { porCnpj: new Map(), porGoogle, enderecos: new Map(), basePublicadaEm: null } },
    async gravar() { throw new Error('transporte não deve gravar') },
  }
  const analise = await analisar(repo, fonte)
  if (!analise.ok) throw new Error('esperava CSV válido')
  expect(analise.conferencia.linhasAceitas).toHaveLength(1)
  expect(analise.conferencia.recusadasIdentidade).toHaveLength(4999)
  const operacao = { chave: '11111111-1111-4111-8111-111111111111', nome: 'Mooca', arquivoNome: 'empresas.csv', metadados: { descricao: '📷'.repeat(500), origem: '📷'.repeat(500), criterios: '📷'.repeat(2000) }, assinatura: 'a'.repeat(64) }
  const token = emitirConferencia({ usuarioId: 'gestor', operacao }, analise.conferencia, { IMPORTACAO_CONFERENCIA_SEGREDO: 'ab'.repeat(32) })!
  const anterior: EstadoImportar = { ...inicial, relatorio: analise.relatorio, conferencia: token }
  const form = new FormData()
  const arquivo = new File([fonte], operacao.arquivoNome)
  form.set('arquivo', arquivo)
  form.set('nome', operacao.nome)
  form.set('chave', operacao.chave)
  form.set('descricao', operacao.metadados.descricao)
  form.set('origem', operacao.metadados.origem)
  form.set('criterios', operacao.metadados.criterios)
  form.set('confirmar', '1')
  form.set('conferencia', token)

  renderToStaticMarkup(<FormularioImportar />)
  const wrapper = vi.mocked(useActionState).mock.calls.at(-1)![0]
  await wrapper(anterior, form)
  const args = vi.mocked(importarAcao).mock.calls[0]
  const encoded = await encodeReply(args)
  const bytes = (await new Response(encoded).arrayBuffer()).byteLength
  // O mesmo relatório/arquivo excedia o limite no caminho anterior; prender
  // essa testemunha impede que reduzir o fixture esconda a regressão.
  const antigo = (await new Response(await encodeReply([anterior, form])).arrayBuffer()).byteLength
  expect(antigo).toBeGreaterThan(2 * 1024 * 1024)
  expect(bytes).toBeLessThan(2 * 1024 * 1024)
  expect(args[0]).toEqual(inicial)
  expect(args[1]).toBe(form)
  expect(args[1].get('arquivo')).toBe(arquivo)
  expect(args[1].get('conferencia')).toBe(token)
  process.stdout.write(JSON.stringify({ arquivoBytes: fonte.byteLength, aceitas: 1, recusadas: 4999, tokenBytes: Buffer.byteLength(token), estadoAnteriorBytes: Buffer.byteLength(JSON.stringify(anterior)), corpoAntigoBytes: antigo, corpoAtualBytes: bytes, limiteBytes: 2 * 1024 * 1024 }) + '\n')
})
