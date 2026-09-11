import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PainelMeuDia, type LinhaMeuDia } from './painel'

const aurora: LinhaMeuDia = {
  id: '11111111-1111-1111-1111-111111111111', cnpj: '11222333000181', razaoSocial: 'Aurora', nomeFantasia: null,
  cnaePrincipal: null, ultimoContato: null, contatoNome: 'Ana', telefone: '11999999999', email: 'ana@aurora.com',
  cep: null, endereco: null, reservadoAte: null, posse: true, proximoPasso: 'Ligar', proximoPassoData: '2026-09-10',
  situacaoRetorno: 'atrasado', vencido: true,
}
const boreal: LinhaMeuDia = {
  id: '22222222-2222-2222-2222-222222222222', cnpj: '22333444000162', razaoSocial: 'Boreal', nomeFantasia: null,
  cnaePrincipal: null, ultimoContato: null, contatoNome: 'Beto', telefone: '11988888888', email: 'beto@boreal.com',
  cep: null, endereco: null, reservadoAte: null, posse: true, proximoPasso: 'Enviar proposta', proximoPassoData: '2026-09-11',
  situacaoRetorno: 'hoje', vencido: false,
}

test('agenda vazia e busca sem resultado dizem coisas diferentes', () => {
  // Agenda vazia de verdade: "0 de 0" não ajuda ninguém, sem contagem.
  const vazia = renderToStaticMarkup(<PainelMeuDia linhas={[]} agenda={[]} filtros={{ nome: '', retorno: '' }} />)
  expect(vazia).toContain('Nenhum retorno pendente para hoje')
  expect(vazia).toContain('href="/carteira"')
  expect(vazia).not.toContain('de 0 retorno')

  // Busca sem resultado: a agenda tem itens, só o filtro não bateu com
  // nenhum. A contagem continua acima do vazio, como sempre apareceu.
  const semResultado = renderToStaticMarkup(<PainelMeuDia linhas={[]} agenda={[aurora, boreal]} filtros={{ nome: 'zzz', retorno: '' }} />)
  expect(semResultado).toContain('Nenhum cliente corresponde à busca')
  expect(semResultado).toContain('href="/meu-dia"')
  expect(semResultado).not.toContain('Nenhum retorno pendente para hoje')
  expect(semResultado).toContain('0 de 2 retornos')
})

test('primeira empresa já aparece selecionada e o link leva a ficha com os filtros', () => {
  const html = renderToStaticMarkup(<PainelMeuDia linhas={[aurora, boreal]} agenda={[aurora, boreal]} filtros={{ nome: '', retorno: 'atrasado' }} />)
  expect(html).toContain('Aurora')
  expect(html).toContain('Abrir atendimento')
  expect(html).toContain(`href="/carteira/${aurora.id}?de=meu-dia&amp;retorno=atrasado"`)
  expect(html).not.toContain('—')

  // "Abrir atendimento" é a ação principal: usa o componente `Button` (como
  // as telas irmãs, `<Button asChild><Link href=...>`), não um link nu.
  // Confere que É a mesma tag que carrega o href da ficha, não outro botão.
  const linkAbrir = html.match(/<a[^>]*href="\/carteira\/[^"]*"[^>]*>Abrir atendimento<\/a>/)?.[0] ?? ''
  expect(linkAbrir).not.toBe('')
  expect(linkAbrir).toContain('data-slot="button"')
})
