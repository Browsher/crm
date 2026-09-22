import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import PaginaWhatsApp from './page'
import LayoutWhatsApp from './layout'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerMensagensRecentes } from '@/src/server/whatsapp/evolution'

vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: vi.fn() }))
vi.mock('@/src/server/whatsapp/evolution', () => ({ lerMensagensRecentes: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(exigir).mockResolvedValue({ usuarioId: 'gestor', nome: 'Ana', papel: 'gestor' } as Awaited<ReturnType<typeof exigir>>)
  vi.mocked(lerMensagensRecentes).mockResolvedValue({ configurado: true, limiteHistorico: '2026-09-21T20:00:00.000Z', temMais: true, total: 590, mensagens: [
    { id: 'm1', conversa: '5511999999999@s.whatsapp.net', nome: 'Cliente', direcao: 'recebida', texto: 'Olá', em: '2026-09-21T14:13:20.000Z' },
    { id: 'm2', conversa: '5511999999999@s.whatsapp.net', nome: null, direcao: 'enviada', texto: 'Resposta', em: '2026-09-21T14:14:20.000Z' },
  ] })
})

test('autoriza gestor antes de consultar e exibe amostra somente leitura', async () => {
  const html = renderToStaticMarkup(await PaginaWhatsApp())
  expect(exigir).toHaveBeenCalledWith('gestor')
  expect(lerMensagensRecentes).toHaveBeenCalledOnce()
  expect(vi.mocked(exigir).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(lerMensagensRecentes).mock.invocationCallOrder[0])
  expect(html).toContain('590 mensagens na Evolution')
  expect(html).toContain('Carregar mensagens anteriores')
  expect(html).toContain('Número de teste')
  expect(html).toContain('Olá')
  expect(html).toContain('Resposta')
  expect(html).not.toContain('<form')
  expect(html).not.toContain('<textarea')
})

test('bloqueio de acesso impede consulta externa', async () => {
  vi.mocked(exigir).mockRejectedValue(new Error('acesso negado'))
  await expect(PaginaWhatsApp()).rejects.toThrow('acesso negado')
  expect(lerMensagensRecentes).not.toHaveBeenCalled()
})

test('sem configuração mostra instrução sem fingir ausência de mensagens', async () => {
  vi.mocked(lerMensagensRecentes).mockResolvedValue({ configurado: false, limiteHistorico: '2026-09-21T20:00:00.000Z', temMais: false, total: 0, mensagens: [] })
  const html = renderToStaticMarkup(await PaginaWhatsApp())
  expect(html).toContain('Integração ainda não configurada')
  expect(html).not.toContain('Nenhuma mensagem')
})

test('mensagem enviada não apresenta o nome da empresa como nome do cliente', async () => {
  vi.mocked(lerMensagensRecentes).mockResolvedValue({ configurado: true, limiteHistorico: '2026-09-21T20:00:00.000Z', temMais: true, total: 1, mensagens: [
    { id: 'm3', conversa: '5511888888888@s.whatsapp.net', nome: 'NTV Box', direcao: 'enviada', texto: 'Retorno', em: '2026-09-21T14:14:20.000Z' },
  ] })
  const html = renderToStaticMarkup(await PaginaWhatsApp())
  expect(html).toContain('1 mensagem na Evolution')
  expect(html).toContain('+5511888888888')
  expect(html).not.toContain('NTV Box')
})

test('layout exige gestor', async () => {
  const html = renderToStaticMarkup(await LayoutWhatsApp({ children: 'Conteúdo' }))
  expect(exigir).toHaveBeenCalledWith('gestor')
  expect(html).toContain('Conteúdo')
})

test('nome recente e telefone confirmado identificam conversa LID sem exibir código', async () => {
  vi.mocked(lerMensagensRecentes).mockResolvedValue({ configurado: true, limiteHistorico: '2026-09-21T20:00:00.000Z', temMais: false, total: 3, mensagens: [
    { id: '1', conversa: '123456789012345@lid', nome: '123456789012345', direcao: 'recebida', texto: 'Antiga', em: '2026-09-20T14:00:00Z' },
    { id: '2', conversa: '123456789012345@lid', nome: 'Jr', telefone: '+5511999999999', direcao: 'recebida', texto: 'Nova', em: '2026-09-21T14:00:00Z' },
    { id: '3', conversa: 'outro@lid', nome: '987654321098765', direcao: 'recebida', texto: 'Outra conversa', em: '2026-09-19T14:00:00Z' },
  ] })
  const html = renderToStaticMarkup(await PaginaWhatsApp())
  expect(html).toContain('Jr')
  expect(html).toContain('+5511999999999')
  expect(html).not.toContain('123456789012345')
  expect(html).not.toContain('987654321098765')
  expect(html).toContain('Contato não identificado')
})

test('telefones conflitantes não são apresentados como identificação confirmada', async () => {
  vi.mocked(lerMensagensRecentes).mockResolvedValue({ configurado: true, limiteHistorico: '2026-09-21T20:00:00.000Z', temMais: false, total: 2, mensagens: ['+5511999999999', '+5511888888888'].map((telefone, i) => ({ id: String(i), conversa: '123@lid', nome: null, telefone, direcao: 'recebida', texto: 'Olá', em: '2026-09-21T14:00:00Z' })) })
  const html = renderToStaticMarkup(await PaginaWhatsApp())
  expect(html).not.toContain('+5511')
  expect(html).toContain('Número não disponibilizado pela integração')
})
