import { expect, test } from 'vitest'
import catalogoIbge from '../server/busca-empresas/cnae-ibge.json'
import { CATALOGO_PROSPECCAO, obterProdutoProspeccao } from './assistente-ia-catalogo'
import { perfisBancoDoProduto, perfisBancoParaSugestao } from './assistente-ia-cnaes-banco'

function perfis(sku: string) {
  return perfisBancoDoProduto(obterProdutoProspeccao(sku)!)
}

function codigos(sku: string, expansao: boolean) {
  return perfis(sku).filter(perfil => Boolean(perfil.expansao) === expansao)
    .flatMap(perfil => perfil.cnaes.map(cnae => cnae.codigo))
}

test('os 40 SKUs têm CNAEs prioritários e expansão com códigos do IBGE', () => {
  const oficiais = new Set(Object.keys(catalogoIbge))
  expect(CATALOGO_PROSPECCAO).toHaveLength(40)
  for (const produto of CATALOGO_PROSPECCAO) {
    const publicos = perfisBancoDoProduto(produto)
    const mapa = publicos.flatMap(perfil => perfil.cnaes)
    expect(codigos(produto.sku, false).length, produto.sku).toBeGreaterThan(0)
    expect(codigos(produto.sku, true).length, produto.sku).toBeGreaterThan(0)
    expect(new Set(publicos.map(perfil => perfil.id)).size).toBe(publicos.length)
    expect(new Set(mapa.map(cnae => cnae.codigo)).size).toBe(mapa.length)
    for (const cnae of mapa) {
      expect(oficiais.has(cnae.codigo), `${produto.sku}: ${cnae.codigo}`).toBe(true)
      expect(cnae.motivo.trim()).not.toBe('')
      if (['4713002', '4693100'].includes(cnae.codigo)) expect(codigos(produto.sku, true)).toContain(cnae.codigo)
    }
  }
})

test('mantém compradores de segurança, instalação e monitoramento em públicos separados', () => {
  expect(perfis('IC-8177').filter(p => !p.expansao).map(p => p.cnaes.map(cnae => cnae.codigo)))
    .toEqual([['4759899'], ['4649401'], ['4321500'], ['8020001']])
  expect(codigos('IC-Q10', true)).not.toContain('6190601')
  expect(perfis('IC-Q10').find(p => p.id === 'lojas_eletronicos')?.cnaes[0].motivo).toMatch(/4G/)
  expect(codigos('QS-003', false)).toEqual(expect.arrayContaining(['4742300', '4673700']))
})

test('prioriza o canal mais diretamente ligado ao produto', () => {
  for (const sku of ['QS-023', 'QS-023-1', 'QS-026']) {
    expect(codigos(sku, false)).toEqual(['4789004', '4649499'])
    expect(codigos(sku, true)).toContain('4623109')
  }
  expect(codigos('QS-030', false)).toEqual(['4753900', '4649401'])
  expect(codigos('QS-030', true)).toEqual(expect.arrayContaining(['4771701', '4772500']))
  expect(codigos('QS-030', true)).not.toContain('4773300')
  expect(codigos('QS-C-003', false)).toContain('4753900')
  expect(codigos('QS-C-003', true)).toContain('4789008')
  expect(codigos('QS-008', false)).toContain('4723700')
  expect(codigos('QS-025', true)).toEqual(expect.arrayContaining(['4541206', '4763603']))
})

test('Games nos projetores depende de escolha explícita e a justificativa acompanha o SKU', () => {
  const primeiro = obterProdutoProspeccao('QS-T-001')!
  const segundo = obterProdutoProspeccao('QS-T-002')!
  expect(perfisBancoParaSugestao(primeiro).map(p => p.id)).not.toContain('lojas_games')
  expect(perfisBancoParaSugestao(primeiro, undefined, 'Games').map(p => p.id)).toContain('lojas_games')
  expect(perfisBancoParaSugestao(primeiro, 'lojas_games')[0].cnaes[0].motivo).not.toMatch(/joystick/i)
  expect(perfisBancoParaSugestao(segundo, 'lojas_games')[0].cnaes[0].motivo).toMatch(/joysticks/i)
  expect(perfis('NTV').map(p => p.id)).not.toContain('lojas_games')
})
