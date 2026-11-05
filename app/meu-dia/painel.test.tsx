import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { PainelMeuDia, type LinhaMeuDia } from './painel'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../funil/acoes', () => ({ semInteresseAcao: vi.fn() }))
vi.mock('../venda-envio', () => ({ transmitirVenda: vi.fn() }))
vi.mock('@/app/empresas/busca/detalhe-acao', () => ({ lerDetalhesEmpresaAcao: vi.fn() }))
vi.mock('@/src/features/contato/acao', () => ({ prepararContatoAcao: vi.fn(), registrarContatoAcao: vi.fn() }))

const aurora: LinhaMeuDia = {
  id: '11111111-1111-1111-1111-111111111111', cnpj: '11222333000181', razaoSocial: 'Aurora', nomeFantasia: null,
  cnaePrincipal: null, ultimoContato: null, contatoNome: 'Ana', telefone: '11999999999', email: 'ana@aurora.com',
  cep: null, endereco: null, situacao: 'atendimento', versao: 1, reservadoAte: null, posse: true, proximoPasso: 'Ligar', proximoPassoData: '2026-09-10',
  situacaoRetorno: 'atrasado', vencido: true,
}
const filtros = { nome: '', retorno: '' as const, periodo: '' as const }
test('agenda vazia e busca sem resultado dizem coisas diferentes', () => {
  const vazia = renderToStaticMarkup(<PainelMeuDia usuarioId="u" linhas={[]} agenda={[]} filtros={filtros} />)
  expect(vazia).toContain('Nenhum retorno pendente')
  expect(vazia).toContain('href="/carteira"')
  expect(vazia).toContain('href="/fila"')
  expect(vazia).not.toContain('de 0 retorno')
  const busca = renderToStaticMarkup(<PainelMeuDia usuarioId="u" linhas={[]} agenda={[aurora]} filtros={{ ...filtros, nome: 'zzz' }} />)
  expect(busca).toContain('Nenhuma empresa corresponde à busca')
  expect(busca).toContain('0 de 1 retorno')
})
test('HTML inicial entrega cards sem painel, dados de contato ou seleção automática', () => {
  const html = renderToStaticMarkup(<PainelMeuDia usuarioId="u" linhas={[aurora]} agenda={[aurora]} filtros={filtros} />)
  expect(html).toContain('Aurora')
  expect(html).toContain('Dados da empresa')
  expect(html).toContain('Abrir retorno')
  expect(html).toContain('Nenhum retorno selecionado')
  expect(html).not.toContain('<aside')
  expect(html).not.toContain('11999999999')
  expect(html).not.toContain('aria-current')
  expect(html).not.toContain('Resumo')
})
