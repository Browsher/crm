import { describe, expect, it } from 'vitest'
import catalogoIbge from '../server/busca-empresas/cnae-ibge.json'
import {
  CATALOGO_PROSPECCAO,
  obterProdutoProspeccao,
  perfisDoProduto,
  pesquisarProdutosProspeccao,
  reconhecerProdutoProspeccao,
} from './assistente-ia-catalogo'

describe('catálogo do assistente de prospecção', () => {
  it('contém apenas os 40 SKUs publicáveis da planilha de produtos', () => {
    const publicaveis = [
      '128GB-V', '32GB-V', '64GB-V', 'ES-P9', 'ES-S6', 'IC-8177', 'IC-A31B', 'IC-A35',
      'IC-A38', 'IC-A58', 'IC-A6-5V', 'IC-A8', 'IC-A8-5V', 'IC-Q10', 'MN-TEC', 'NTV',
      'QS-001', 'QS-003', 'QS-004', 'QS-007', 'QS-008', 'QS-009', 'QS-010', 'QS-011',
      'QS-019', 'QS-023', 'QS-023-1', 'QS-025', 'QS-026', 'QS-027', 'QS-028', 'QS-030',
      'QS-031', 'QS-032', 'QS-B-003', 'QS-C-001', 'QS-C-002', 'QS-C-003', 'QS-T-001', 'QS-T-002',
    ]

    expect(CATALOGO_PROSPECCAO.map(produto => produto.sku).sort()).toEqual(publicaveis)
    expect(obterProdutoProspeccao('128GB')).toBeUndefined()
    expect(obterProdutoProspeccao(' 128gb-v ')?.sku).toBe('128GB-V')
    for (const produto of CATALOGO_PROSPECCAO) {
      expect(Object.keys(produto).sort()).toEqual(['especialidades', 'familia', 'ficha', 'nome', 'sku'])
      expect(produto.ficha).not.toMatch(/GTIN|R\$|https?:\/\/|\.png\b|@/i)
    }
  })

  it('distingue as duas garrafas publicáveis pelo SKU e pelo material', () => {
    expect(pesquisarProdutosProspeccao('garrafa cachorro').map(produto => produto.sku)).toEqual(['QS-023', 'QS-023-1'])
    expect(obterProdutoProspeccao('QS-023')?.ficha).toMatch(/aço 304/i)
    expect(obterProdutoProspeccao('QS-023-1')?.ficha).toMatch(/acrílico/i)
    expect(pesquisarProdutosProspeccao('qs-023-1').map(produto => produto.sku)).toEqual(['QS-023-1'])
  })

  it('filtra a lista por SKU, nome sem acentos e partes do nome', () => {
    expect(pesquisarProdutosProspeccao('ic-a8').map(produto => produto.sku)).toEqual(['IC-A8', 'IC-A8-5V'])
    expect(pesquisarProdutosProspeccao('ic a8').map(produto => produto.sku)).toEqual(['IC-A8', 'IC-A8-5V'])
    expect(pesquisarProdutosProspeccao('camera lampada').map(produto => produto.sku)).toEqual(['IC-8177'])
    expect(pesquisarProdutosProspeccao('cartao microsd 128gb').map(produto => produto.sku)).toEqual(['128GB-V'])
    expect(pesquisarProdutosProspeccao('tartaruga').map(produto => produto.sku)).toEqual(['QS-030'])
    expect(pesquisarProdutosProspeccao('produto inexistente')).toEqual([])
    expect(pesquisarProdutosProspeccao('')).toHaveLength(40)
  })

  it.each([
    ['Quero revender a câmera lâmpada em Curitiba', 'IC-8177'],
    ['Estou procurando clientes para o Massageador tartaruga.', 'QS-030'],
    ['Quero vender o SKU qs-023-1 em SP.', 'QS-023-1'],
    ['Quero revender QS-023-1, garrafa para cachorro de acrílico', 'QS-023-1'],
    ['Prospecção para QS-023', 'QS-023'],
    ['Busco lojistas para (IC-A8-5V).', 'IC-A8-5V'],
    ['Vender 128GB-V', '128GB-V'],
    ['Para cartão micro SD 128GB', '128GB-V'],
    ['Vendo garrafa para cachorro de acrílico', 'QS-023-1'],
  ])('reconhece um produto inequívoco em %j', (frase, sku) => {
    expect(reconhecerProdutoProspeccao(frase)?.sku).toBe(sku)
  })

  it.each([
    'Quero vender garrafa para cachorro',
    'Quero vender câmera Wi-Fi',
    'Vender 128GB',
    'SKU 128GB, cartão micro SD 128GB',
    'SKU QS-023-10',
    'Não é o SKU XQS-023',
    'Vender QS-023 e QS-023-1',
    'Vender QS-023-1 e mouse sem fio',
    'Prospectar pelo SKU QS-023 (garrafa para cachorro de acrílico)',
    'Massageador tartaruga e mouse sem fio',
    'Vendemos miniaspirador de pó sem fiozinho',
  ])('deixa a seleção em aberto para %j', frase => {
    expect(reconhecerProdutoProspeccao(frase)).toBeUndefined()
  })

  it('exibe especialidades pertinentes a cada SKU da mesma família', () => {
    expect(obterProdutoProspeccao('QS-031')?.especialidades).toEqual(['Cuidados com roupas'])
    expect(obterProdutoProspeccao('QS-032')?.especialidades).toEqual(['Limpeza doméstica'])
    expect(obterProdutoProspeccao('QS-019')?.especialidades).toEqual(['Higiene bucal'])
    expect(obterProdutoProspeccao('QS-030')?.especialidades).toEqual(['Aparelhos de cuidados pessoais'])
    expect(obterProdutoProspeccao('IC-8177')?.especialidades).toContain('CFTV residencial')
  })

  it('oferece vários usos comerciais para TV Box e projetores sem duplicar os SKUs', () => {
    const tvBox = obterProdutoProspeccao('NTV')!
    const projetor = obterProdutoProspeccao('QS-T-001')!
    const projetorComJoystick = obterProdutoProspeccao('QS-T-002')!

    expect(tvBox.especialidades).toEqual(['Streaming e TV', 'Home theater', 'Acessórios para TV'])
    for (const item of [projetor, projetorComJoystick]) {
      expect(item.familia).toBe(tvBox.familia)
      expect(item.especialidades).toEqual(expect.arrayContaining(['Projeção', 'Karaokê', 'Games']))
      expect(item.ficha).toMatch(/dois microfones/)
      expect(perfisDoProduto(item).find(perfil => perfil.id === 'lojas_games')).toMatchObject({
        especialidades: ['Games'],
        cnaes: [{ codigo: '4763601', amplo: true }],
      })
    }
    expect(projetor.ficha).not.toMatch(/joystick/i)
    expect(projetorComJoystick.ficha).toMatch(/dois joysticks/)
    expect(perfisDoProduto(tvBox).some(perfil => perfil.id === 'lojas_games')).toBe(false)
  })

  it('agrupa as câmeras de segurança e refina o uso comercial conforme o modelo', () => {
    const lampada = obterProdutoProspeccao('IC-8177')!
    const camera4G = obterProdutoProspeccao('IC-Q10')!

    expect(lampada.familia).toBe(camera4G.familia)
    expect(lampada.especialidades).not.toContain('CFTV comercial')
    expect(camera4G.especialidades).toContain('CFTV comercial')
  })

  it('restringe o cabo aos públicos e à especialidade de acessórios de instalação', () => {
    const produto = obterProdutoProspeccao('QS-003')!

    expect(produto.especialidades).toEqual(['Acessórios de instalação'])
    expect(perfisDoProduto(produto).map(perfil => perfil.id)).toEqual(['lojas', 'distribuidores', 'instaladores'])
  })

  it('mantém revenda, instalação e monitoramento da câmera em atividades distintas', () => {
    const perfis = perfisDoProduto(obterProdutoProspeccao('IC-8177')!)

    expect(perfis.map(perfil => [perfil.id, perfil.cnaes.map(cnae => cnae.codigo)])).toEqual([
      ['lojas', ['4759899']],
      ['distribuidores', ['4649401']],
      ['instaladores', ['4321500']],
      ['monitoramento', ['8020001']],
    ])
    expect(perfis[0].cnaes[0].amplo).toBe(true)
    expect(perfis[2].tipoGoogle).toBeUndefined()
    expect(perfis[3].especialidades).toEqual(['Monitoramento'])
  })

  it('deixa lojas de bem-estar para o Google quando o CNAE não representa o público', () => {
    const perfis = perfisDoProduto(obterProdutoProspeccao('QS-030')!)

    expect(perfis.find(perfil => perfil.id === 'lojas')).toMatchObject({ cnaes: [], tipoGoogle: 'varejista' })
    expect(perfis.find(perfil => perfil.id === 'distribuidores')?.cnaes).toMatchObject([
      { codigo: '4649401', amplo: true },
    ])
  })

  it('distingue atacado de suprimentos, atacado de equipamentos e varejo de informática', () => {
    const perfisCartao = perfisDoProduto(obterProdutoProspeccao('128GB-V')!)
    const perfisTeclado = perfisDoProduto(obterProdutoProspeccao('MN-TEC')!)

    expect(perfisCartao.find(perfil => perfil.id === 'lojas')?.cnaes.map(cnae => cnae.codigo)).toEqual(['4751201'])
    expect(perfisCartao.find(perfil => perfil.id === 'distribuidores')?.cnaes.map(cnae => cnae.codigo)).toEqual(['4651602'])
    expect(perfisTeclado.find(perfil => perfil.id === 'distribuidores')?.cnaes.map(cnae => cnae.codigo)).toEqual(['4651601'])
  })

  it('usa exclusivamente CNAEs do IBGE e especialidades do SKU em cada público', () => {
    const oficiais = new Set(Object.keys(catalogoIbge))

    for (const produto of CATALOGO_PROSPECCAO) {
      const perfis = perfisDoProduto(produto)
      expect(perfis.length).toBeGreaterThan(0)
      expect(new Set(perfis.map(perfil => perfil.id)).size).toBe(perfis.length)
      for (const perfil of perfis) {
        expect(perfil.especialidades.every(especialidade => produto.especialidades.includes(especialidade))).toBe(true)
        for (const cnae of perfil.cnaes) {
          expect(oficiais.has(cnae.codigo)).toBe(true)
          expect(cnae.motivo.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })
})
