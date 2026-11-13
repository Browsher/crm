import { perfisDoProduto, type PerfilProspeccao, type ProdutoProspeccao } from './assistente-ia-catalogo'

type PerfilBanco = PerfilProspeccao & { expansao?: boolean }
type Canal = readonly [id: string, rotulo: string, motivo: string]

const CANAIS = {
  '4321500': ['instaladores', 'Instaladores de sistemas de segurança', 'Considere instaladores que forneçam câmeras junto com cartões de memória.'],
  '4530703': ['lojas_autopecas', 'Lojas de autopeças', 'Considere lojas que revendem acessórios automotivos.'],
  '4541206': ['lojas_motos', 'Lojas de peças e acessórios para motos', 'Confira a compatibilidade dos bicos e da pressão do inflador com pneus de moto.'],
  '4623109': ['atacado_racao', 'Atacadistas de alimentos para animais', 'Procure distribuidores de ração que também revendam acessórios pet.'],
  '4635499': ['atacado_bebidas', 'Distribuidores de bebidas', 'Considere distribuidores que também revendam acessórios para vinho.'],
  '4646002': ['atacado_higiene', 'Distribuidores de produtos de higiene pessoal', 'Considere distribuidores com linha de acessórios de cuidados pessoais.'],
  '4649401': ['atacado_eletroportateis', 'Distribuidores de eletroportáteis', 'Inclui atacado de equipamentos elétricos de uso pessoal e doméstico. Confira o mix de eletroportáteis.'],
  '4649402': ['atacado_eletronicos', 'Distribuidores de eletrônicos', 'Considere distribuidores de eletrônicos de uso pessoal e doméstico que revendam o produto ou acessórios da mesma linha.'],
  '4649499': ['atacado_artigos_pessoais', 'Distribuidores de artigos de uso pessoal e doméstico', 'Considere distribuidores que trabalhem com acessórios do segmento.'],
  '4652400': ['atacado_comunicacao', 'Distribuidores de componentes e equipamentos de comunicação', 'Considere distribuidores de componentes e equipamentos de comunicação que também trabalhem com o produto.'],
  '4672900': ['atacado_ferragens', 'Distribuidores de ferragens e ferramentas', 'Procure distribuidores que revendam acessórios de instalação, irrigação ou ferramentas, conforme o produto.'],
  '4673700': ['atacado_eletrico', 'Distribuidores de material elétrico', 'Procure atacadistas que abasteçam revendas de cabos e acessórios de instalação.'],
  '4679699': ['atacado_construcao', 'Distribuidores de materiais de construção', 'Considere distribuidores com seção de irrigação e conexões para mangueira.'],
  '4693100': ['atacado_generalista', 'Atacadistas de mercadorias em geral', 'Confira se o atacadista distribui itens da mesma linha que o produto escolhido.'],
  '4711302': ['supermercados', 'Supermercados com seção de bazar', 'Procure supermercados que revendam utilidades ou eletroportáteis na seção de bazar.'],
  '4713002': ['lojas_variedades', 'Lojas de variedades', 'Procure lojas de variedades que revendam produtos do mesmo segmento.'],
  '4713004': ['magazines', 'Lojas de departamentos e magazines', 'Considere redes com uma seção compatível com o produto.'],
  '4723700': ['adegas', 'Adegas e lojas de bebidas', 'Procure lojas que vendam acessórios para vinho junto com as bebidas.'],
  '4729602': ['conveniencia', 'Lojas de conveniência', 'Considere lojas que também revendam acessórios do segmento.'],
  '4742300': ['lojas_material_eletrico', 'Lojas de material elétrico', 'Procure lojas que atendam instaladores e revendam cabos ou acessórios da mesma linha.'],
  '4744001': ['lojas_ferragens', 'Lojas de ferragens e ferramentas', 'Considere lojas de ferragens com uma seção compatível com o produto.'],
  '4744099': ['lojas_construcao', 'Lojas de materiais de construção', 'Procure lojas que revendam o produto ou acessórios da mesma linha.'],
  '4751201': ['lojas_informatica', 'Lojas de informática', 'Considere lojas de informática que também revendam o produto ou acessórios relacionados.'],
  '4752100': ['lojas_telefonia', 'Lojas de telefonia e comunicação', 'Considere lojas de telefonia que também revendam o produto ou acessórios relacionados.'],
  '4753900': ['lojas_eletronicos', 'Lojas de eletroportáteis e eletrônicos', 'Procure lojas de eletrodomésticos e de áudio e vídeo que revendam o produto ou itens da mesma linha.'],
  '4759899': ['lojas_utilidades', 'Lojas de utilidades domésticas', 'Considere lojas de utilidades com uma seção compatível com o produto.'],
  '4761003': ['papelarias', 'Papelarias', 'Considere papelarias que também revendam produtos do segmento.'],
  '4763602': ['lojas_esporte', 'Lojas de artigos esportivos', 'Considere lojas que vendam infladores. Confira a compatibilidade com válvulas de bolas.'],
  '4763603': ['lojas_bicicletas', 'Lojas de bicicletas e acessórios', 'Confira a compatibilidade dos bicos e da pressão do inflador com pneus de bicicleta.'],
  '4771701': ['farmacias', 'Farmácias e drogarias', 'Considere farmácias com uma seção de acessórios de cuidados pessoais.'],
  '4771704': ['lojas_veterinarias', 'Lojas de medicamentos veterinários', 'Considere lojas que também revendam acessórios para animais.'],
  '4772500': ['perfumarias', 'Lojas de perfumaria e higiene pessoal', 'Considere lojas que revendam acessórios de cuidados pessoais.'],
  '4774100': ['oticas', 'Óticas', 'Considere óticas que também revendam óculos com eletrônicos integrados.'],
  '4782202': ['lojas_viagem', 'Lojas de artigos de viagem', 'Considere lojas que também revendam eletroportáteis de viagem.'],
  '4789001': ['lojas_presentes', 'Lojas de suvenires e presentes', 'Considere lojas que revendam brinquedos de lógica como presentes.'],
  '4789002': ['lojas_jardim', 'Lojas de plantas e flores', 'Considere lojas que também revendam acessórios de irrigação.'],
  '4789007': ['lojas_escritorio', 'Lojas de equipamentos para escritório', 'Considere lojas que também revendam periféricos de informática.'],
  '4789008': ['lojas_artigos_fotograficos', 'Lojas de artigos para foto e filmagem', 'Considere lojas de artigos fotográficos que também revendam câmeras ou acessórios compatíveis.'],
  '4789099': ['lojas_produtos_diversos', 'Lojas de produtos diversos', 'Considere lojas que tenham uma seção de eletrônicos portáteis.'],
  '6190601': ['provedores_internet', 'Provedores de internet', 'Considere somente provedores que ofereçam instalação ou revenda de câmeras Wi-Fi.'],
  '7500100': ['clinicas_veterinarias', 'Clínicas veterinárias', 'Considere clínicas com loja ou revenda de acessórios no balcão.'],
  '8020001': ['monitoramento', 'Empresas de monitoramento', 'Considere empresas de monitoramento que também forneçam equipamentos de CFTV.'],
  '9511800': ['assistencias_informatica', 'Assistências técnicas de informática', 'Considere assistências que também revendam periféricos.'],
  '9512600': ['assistencias_celular', 'Assistências técnicas de celular', 'Considere assistências que também revendam acessórios para celular.'],
  '9609208': ['banho_tosa', 'Serviços de banho e tosa', 'Considere estabelecimentos que também revendam acessórios pet no balcão.'],
} as const satisfies Record<string, Canal>

type CodigoCanal = keyof typeof CANAIS
type MapaCanais = {
  prioritarios?: readonly CodigoCanal[]
  expansao: readonly CodigoCanal[]
  motivos?: Readonly<Partial<Record<CodigoCanal, string>>>
}

const CAMERA = ['4753900', '4752100', '4751201', '4742300', '4649402', '4652400',
  '4713002', '4673700', '4693100'] as const
const CAMERAS_WIFI: MapaCanais = { expansao: [...CAMERA, '6190601'] }
const CARTOES: MapaCanais = {
  prioritarios: ['4752100'],
  expansao: ['4652400', '8020001', '4789008', '4713002', '4321500', '9512600'],
}
const MINI_CAMERA: MapaCanais = {
  expansao: ['4752100', '4751201', '4789008', '4789099', '4713002', '4652400'],
}
const COZINHA = ['4713002', '4711302', '4693100'] as const
const ELETROPORTATEIS = ['4713004', '4713002', '4711302', '4693100'] as const
const PERIFERICOS = ['4752100', '4761003', '4789007', '4713002', '9511800'] as const
const PET = ['4623109', '4771704', '9609208', '7500100'] as const

// Fonte: cnae-por-sku.xlsx (Publicar = sim), revisada com os descritores do IBGE.
const POR_SKU: Readonly<Partial<Record<string, MapaCanais>>> = {
  '128GB-V': CARTOES, '32GB-V': CARTOES, '64GB-V': CARTOES,
  'ES-P9': CAMERAS_WIFI, 'ES-S6': CAMERAS_WIFI, 'IC-8177': CAMERAS_WIFI, 'IC-A31B': CAMERAS_WIFI,
  'IC-A35': CAMERAS_WIFI, 'IC-A38': CAMERAS_WIFI, 'IC-A58': CAMERAS_WIFI, 'IC-A6-5V': CAMERAS_WIFI,
  'IC-A8': CAMERAS_WIFI, 'IC-A8-5V': CAMERAS_WIFI,
  'IC-Q10': {
    expansao: CAMERA,
    motivos: {
      '4753900': 'Considere lojas de eletrônicos que revendam câmeras 4G para locais sem Wi-Fi.',
      '4752100': 'Procure revendas de equipamentos de comunicação com câmeras 4G.',
      '4751201': 'Considere lojas de informática que tenham câmeras 4G no mix.',
    },
  },
  'MN-TEC': { expansao: ['4753900', ...PERIFERICOS] },
  NTV: { prioritarios: ['4752100'], expansao: ['4751201', '4652400'] },
  'QS-001': { expansao: COZINHA },
  'QS-003': {
    prioritarios: ['4742300', '4673700'],
    expansao: ['8020001', '4744001', '4744099'],
  },
  'QS-004': { prioritarios: ['4753900', '4649401'], expansao: ['4751201', '4530703'] },
  'QS-007': {
    prioritarios: ['4672900', '4744001'],
    expansao: ['4744099', '4789002', '4679699'],
    motivos: { '4672900': 'Procure distribuidores de ferragens que revendam adaptadores e conexões para mangueira.' },
  },
  'QS-008': { prioritarios: ['4723700'], expansao: [...COZINHA, '4635499'] },
  'QS-009': { expansao: COZINHA },
  'QS-010': {
    prioritarios: ['4652400'], expansao: ['4713002', '4751201', '4729602', '4761003', '4649499', '9512600'],
    motivos: { '4729602': 'Considere lojas de conveniência com seção de acessórios para celular.' },
  },
  'QS-011': { expansao: PERIFERICOS },
  'QS-019': { prioritarios: ['4772500', '4771701', '4646002'], expansao: ['4753900', '4759899'] },
  'QS-023': { expansao: PET },
  'QS-023-1': { expansao: PET },
  'QS-025': {
    expansao: ['4541206', '4763603', '4763602', '4744001', '4729602'],
    motivos: { '4729602': 'Considere conveniências de postos que vendam infladores ou acessórios para pneus.' },
  },
  'QS-026': { expansao: [...PET, '4753900'] },
  'QS-027': { prioritarios: ['4753900', '4649401'], expansao: ELETROPORTATEIS },
  'QS-028': {
    expansao: ['4729602'],
    motivos: { '4729602': 'Considere conveniências de postos que vendam organizadores e outros acessórios para o interior do carro.' },
  },
  'QS-030': { expansao: ['4772500', '4771701', '4646002'] },
  'QS-031': { prioritarios: ['4759899'], expansao: [...ELETROPORTATEIS, '4782202'] },
  'QS-032': { prioritarios: ['4759899'], expansao: ELETROPORTATEIS },
  'QS-B-003': { expansao: ['4761003', '4713002', '4789001', '4693100'] },
  'QS-C-001': MINI_CAMERA,
  'QS-C-002': MINI_CAMERA,
  'QS-C-003': { expansao: [...MINI_CAMERA.expansao, '4774100'] },
  'QS-T-001': { expansao: ['4713004'] },
  'QS-T-002': { expansao: ['4713004'] },
}

export function perfisBancoDoProduto(produto: ProdutoProspeccao): readonly PerfilBanco[] {
  const mapa = POR_SKU[produto.sku]
  const perfis: PerfilBanco[] = perfisDoProduto(produto).flatMap(perfil => {
    if (perfil.id === 'lojas_games') {
      const motivo = produto.sku === 'QS-T-002'
        ? 'O kit tem dois joysticks e dois microfones. Considere lojas que revendam projetores com jogos.'
        : 'O projetor vem com dois microfones. Considere lojas de games que também vendam projetores e equipamentos de karaokê.'
      return [{ ...perfil, expansao: true, cnaes: perfil.cnaes.map(cnae => ({ ...cnae, motivo })) }]
    }
    if (produto.sku === 'QS-030' && perfil.id === 'lojas') {
      return [{ ...perfil, rotulo: 'Lojas de eletroportáteis', nicho: 'Eletroportáteis',
        cnaes: [{ codigo: '4753900', motivo: 'Considere lojas que revendam aparelhos portáteis de cuidados pessoais.', amplo: true }] }]
    }
    return perfil.cnaes.length ? [perfil] : []
  })

  function criarPerfil(codigo: CodigoCanal, expansao: boolean): PerfilBanco {
    const [id, rotulo, motivo] = CANAIS[codigo]
    const motivoProduto = ['4693100', '4713002', '4713004'].includes(codigo)
      ? `Confira se o mix inclui itens da mesma linha que o produto ${produto.nome}.` : motivo
    return {
      id, rotulo, nicho: rotulo, especialidades: produto.especialidades, expansao,
      cnaes: [{ codigo, motivo: mapa?.motivos?.[codigo] ?? motivoProduto, amplo: true }],
    }
  }

  return [
    ...perfis.filter(perfil => !perfil.expansao),
    ...(mapa?.prioritarios ?? []).map(codigo => criarPerfil(codigo, false)),
    ...perfis.filter(perfil => perfil.expansao),
    ...(mapa?.expansao ?? []).map(codigo => criarPerfil(codigo, true)),
  ]
}

export function perfisBancoParaSugestao(produto: ProdutoProspeccao, publico?: string, especialidade?: string) {
  return perfisBancoDoProduto(produto).filter(perfil =>
    (!especialidade || perfil.especialidades.includes(especialidade)) &&
    (publico ? perfil.id === publico : !perfil.expansao || (perfil.id === 'lojas_games' && especialidade === 'Games')),
  )
}
