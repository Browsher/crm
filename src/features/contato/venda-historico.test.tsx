import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { Contato } from './historico'
import { eventosDeContatos, LinhaDoTempo } from './linha-do-tempo'

const venda: Contato = {
  id: 'venda:1', tipo: 'venda_registrada', natureza: 'venda', nota: null,
  proximoPasso: null, proximoPassoData: null,
  criadoEm: new Date('2026-11-05T13:30:00Z'), autor: 'Vendedor',
  venda: { centavos: '125050', data: '2026-11-04' },
}

test('venda começa recolhida e distingue data da venda, instante registrado e autor', () => {
  const html = renderToStaticMarkup(<LinhaDoTempo contatos={[venda]} />)
  expect(html).toContain('<details')
  expect(html).not.toContain('open=""')
  expect(html).toContain('Venda registrada')
  expect(html).toContain('1.250,50')
  expect(html).toContain('04/11/2026')
  expect(html).toContain('05/11/2026')
  expect(html).toContain('10:30')
  expect(html).toContain('Vendedor')
})

test('adaptador preserva tipo desconhecido, nota longa, retorno civil e autor nulo sem inventar sistema', () => {
  const nota = 'Negociação completa.\n'.repeat(60)
  const html = renderToStaticMarkup(<LinhaDoTempo contatos={[{
    ...venda, id: 'contato:1', tipo: 'tipo legado', natureza: 'contato', venda: undefined,
    criadoEm: new Date('2026-11-05T01:30:00Z'), autor: null, nota,
    proximoPasso: 'Enviar catálogo', proximoPassoData: '2026-10-01',
  }]} />)
  expect(html).toContain('tipo legado')
  expect(html).toContain(nota)
  expect(html).toContain('Autor não informado')
  expect(html).not.toContain('sistema')
  expect(html).toContain('04/11/2026')
  expect(html).toContain('22:30')
  expect(html).toMatch(/datetime="2026-10-01"/i)
  expect(html).not.toMatch(/atrasad|atraso/i)
})

test('adaptador usa rótulos conhecidos e distingue atividade sem ligação preservando a ordem recebida', () => {
  const html = renderToStaticMarkup(<LinhaDoTempo contatos={[
    { ...venda, id: 'atividade:1', venda: undefined, tipo: 'nao_liguei', natureza: 'atividade_sem_ligacao' },
    { ...venda, id: 'contato:2', venda: undefined, tipo: 'interessado', natureza: 'contato' },
    venda,
  ]} />)
  expect(html).toContain('Atividade sem ligação')
  expect(html).toContain('Não liguei')
  expect(html).toContain('Falei, tem interesse')
  expect(html.indexOf('Atividade sem ligação')).toBeLessThan(html.indexOf('Falei, tem interesse'))
  expect(html.indexOf('Falei, tem interesse')).toBeLessThan(html.indexOf('Venda registrada'))
})

test('projeção neutra preserva os campos existentes sem inventar vendas para um recorte de contatos', () => {
  const contatos = Object.freeze([{ ...venda, id: 'contato:1', tipo: 'nao_liguei', natureza: 'atividade_sem_ligacao' as const, venda: undefined }])
  expect(eventosDeContatos(contatos)).toEqual([{
    id: 'contato:1', natureza: 'atividade_sem_ligacao', titulo: 'Atividade sem ligação', criadoEm: '2026-11-05T13:30:00.000Z', autor: 'Vendedor', nota: null, resultado: 'Não liguei',
  }])
  const html = renderToStaticMarkup(<LinhaDoTempo contatos={contatos} controleFiltro={{ valor: 'vendas', aoMudar: () => {} }} conteudoVazio={<p>Sem vendas neste recorte</p>} />)
  expect(html).toContain('Sem vendas neste recorte')
  expect(html).toContain('Filtrar eventos')
  expect(html).not.toContain('<details')
  expect(html).not.toContain('Venda registrada')
})
