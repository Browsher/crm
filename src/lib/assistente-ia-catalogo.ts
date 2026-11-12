export type ProdutoProspeccao = {
  sku: string
  nome: string
  familia: string
  ficha: string
  especialidades: readonly string[]
}

export type PerfilProspeccao = {
  id: string
  rotulo: string
  nicho: string
  cnaes: readonly { codigo: string; motivo: string; amplo?: boolean }[]
  especialidades: readonly string[]
  tipoGoogle?: 'varejista' | 'atacadista' | 'distribuidor'
}

type CnaePerfil = PerfilProspeccao['cnaes'][number]
type PerfilGrupo = Omit<PerfilProspeccao, 'especialidades'> & {
  especialidades?: readonly string[]
}
type ProdutoGrupo = Omit<ProdutoProspeccao, 'familia'> & { nomesAlternativos?: readonly string[] }
type GrupoCatalogo = {
  familia: string
  perfis: readonly PerfilGrupo[]
  produtos: readonly ProdutoGrupo[]
}

function lojas(nicho: string, cnaes: readonly CnaePerfil[], rotulo = `Lojas de ${nicho}`): PerfilGrupo {
  return { id: 'lojas', rotulo, nicho, cnaes, tipoGoogle: 'varejista' }
}

function distribuidores(
  nicho: string,
  cnaes: readonly CnaePerfil[],
  tipoGoogle: 'atacadista' | 'distribuidor' = 'distribuidor',
): PerfilGrupo {
  const rotulo = tipoGoogle === 'atacadista' ? 'Atacadistas' : 'Distribuidores'
  return { id: 'distribuidores', rotulo: `${rotulo} de ${nicho}`, nicho, cnaes, tipoGoogle }
}

const CFTV_RESIDENCIAL = 'CFTV residencial'
const CFTV_COMERCIAL = 'CFTV comercial'
const MONITORAMENTO = 'Monitoramento'
const ACESSORIOS_INSTALACAO = 'Acessórios de instalação'
const ESPECIALIDADES_CFTV = [CFTV_RESIDENCIAL, CFTV_COMERCIAL, ACESSORIOS_INSTALACAO]
const CAMERA_RESIDENCIAL = [CFTV_RESIDENCIAL, MONITORAMENTO]
const CAMERA_RESIDENCIAL_COMERCIAL = [CFTV_RESIDENCIAL, CFTV_COMERCIAL, MONITORAMENTO]
const FOTO_VIDEO = ['Foto e vídeo', 'Eletrônicos portáteis']
const CARTAO_MEMORIA = ['Cartões de memória', 'Suprimentos de informática']
const PERIFERICOS = ['Periféricos']
const PASSEIO_PET = ['Passeio e hidratação de cães']
const GAMES = 'Games'
const ESPECIALIDADES_PROJETORES = ['Projeção', 'Home theater', 'Karaokê', GAMES]

const CNAE_VAREJO_AUDIO_VIDEO = {
  codigo: '4753900', motivo: 'Cobre o varejo especializado de equipamentos de áudio e vídeo e eletrodomésticos.', amplo: true,
}
const CNAE_ATACADO_AUDIO_VIDEO = {
  codigo: '4649402', motivo: 'Cobre atacadistas de eletrônicos de uso pessoal e doméstico, incluindo equipamentos de áudio e vídeo.', amplo: true,
}
const VAREJO_INFORMATICA = lojas('informática', [
  { codigo: '4751201', motivo: 'Representa lojas de equipamentos e suprimentos de informática.' },
])

// Fonte dos SKUs e das fichas: aba Produtos da planilha do catálogo QS Importação (Publicar = sim).
const GRUPOS: readonly GrupoCatalogo[] = [
  {
    familia: 'Câmeras de segurança e cabo',
    perfis: [
      {
        ...lojas('segurança eletrônica', [
          { codigo: '4759899', motivo: 'Inclui varejo de sistemas de segurança, entre outros artigos de uso pessoal e doméstico.', amplo: true },
        ]),
        especialidades: ESPECIALIDADES_CFTV,
      },
      {
        ...distribuidores('CFTV', [
          { codigo: '4649401', motivo: 'Inclui atacado de equipamentos de segurança de uso doméstico, além de outros equipamentos elétricos.', amplo: true },
        ]),
        especialidades: ESPECIALIDADES_CFTV,
      },
      {
        id: 'instaladores',
        rotulo: 'Instaladores de câmeras',
        nicho: 'Instalação de CFTV',
        cnaes: [
          { codigo: '4321500', motivo: 'Inclui instalação de sistemas de segurança sem monitoramento, além de outros serviços de instalação elétrica.', amplo: true },
        ],
        especialidades: ESPECIALIDADES_CFTV,
      },
      {
        id: 'monitoramento',
        rotulo: 'Empresas de monitoramento',
        nicho: 'Monitoramento de segurança eletrônica',
        cnaes: [
          { codigo: '8020001', motivo: 'Representa empresas que monitoram sistemas de segurança eletrônica.' },
        ],
        especialidades: [MONITORAMENTO],
      },
    ],
    produtos: [
      {
        sku: 'ES-P9', nome: 'Câmera P9 1MP Wi-Fi',
        ficha: 'Câmera Wi-Fi de 1 MP com aplicativo EseeCloud e fonte DC 12 V.',
        especialidades: CAMERA_RESIDENCIAL,
      },
      {
        sku: 'ES-S6', nome: 'Câmera S6 6MP Wi-Fi',
        ficha: 'Câmera Wi-Fi de 6 MP com aplicativo EseeCloud e fonte DC 12 V.',
        especialidades: CAMERA_RESIDENCIAL_COMERCIAL,
      },
      {
        sku: 'IC-8177', nome: 'Câmera lâmpada 2MP Wi-Fi',
        ficha: 'Câmera lâmpada Wi-Fi de 2 MP, soquete E27 e aplicativo ICSee.',
        nomesAlternativos: ['Câmera lâmpada'],
        especialidades: CAMERA_RESIDENCIAL,
      },
      {
        sku: 'IC-A31B', nome: 'Câmera A31B 6MP Wi-Fi',
        ficha: 'Câmera Wi-Fi de 6 MP com aplicativo ICSee e fonte DC 12 V.',
        especialidades: CAMERA_RESIDENCIAL_COMERCIAL,
      },
      {
        sku: 'IC-A35', nome: 'Câmera A35 4MP Wi-Fi',
        ficha: 'Câmera Wi-Fi de 4 MP com aplicativo ICSee e fonte DC 12 V.',
        especialidades: CAMERA_RESIDENCIAL_COMERCIAL,
      },
      {
        sku: 'IC-A38', nome: 'Câmera A38 6MP Wi-Fi',
        ficha: 'Câmera Wi-Fi de 6 MP com aplicativo ICSee e fonte DC 12 V.',
        especialidades: CAMERA_RESIDENCIAL_COMERCIAL,
      },
      {
        sku: 'IC-A58', nome: 'Câmera A58 6MP Wi-Fi',
        ficha: 'Câmera Wi-Fi de 6 MP com aplicativo ICSee e fonte DC 12 V.',
        especialidades: CAMERA_RESIDENCIAL_COMERCIAL,
      },
      {
        sku: 'IC-A6-5V', nome: 'Câmera A6-5V 3MP Wi-Fi',
        ficha: 'Câmera Wi-Fi de 3 MP com aplicativo ICSee e fonte DC 12 V.',
        especialidades: CAMERA_RESIDENCIAL,
      },
      {
        sku: 'IC-A8', nome: 'Câmera A8 3MP Wi-Fi',
        ficha: 'Câmera Wi-Fi de 3 MP com aplicativo ICSee e fonte DC 12 V.',
        especialidades: CAMERA_RESIDENCIAL,
      },
      {
        sku: 'IC-A8-5V', nome: 'Câmera A8-5V 2MP Wi-Fi',
        ficha: 'Câmera Wi-Fi de 2 MP com aplicativo ICSee e fonte DC 12 V.',
        especialidades: CAMERA_RESIDENCIAL,
      },
      {
        sku: 'IC-Q10', nome: 'Câmera Q10 4MP 4G',
        ficha: 'Câmera 4G de 4 MP, aplicativo ICSee e alimentação solar e DC 5 V.',
        especialidades: CAMERA_RESIDENCIAL_COMERCIAL,
      },
      {
        sku: 'QS-003', nome: 'Cabo extensor para câmera',
        ficha: 'Cabo extensor para câmera em PVC com tomada tipo N.',
        nomesAlternativos: ['Cabo extensor câmera'],
        especialidades: [ACESSORIOS_INSTALACAO],
      },
    ],
  },
  {
    familia: 'Minicâmeras e foto/vídeo',
    perfis: [
      lojas('equipamentos de foto e vídeo', [CNAE_VAREJO_AUDIO_VIDEO]),
      distribuidores('eletrônicos portáteis', [CNAE_ATACADO_AUDIO_VIDEO]),
    ],
    produtos: [
      {
        sku: 'QS-C-001', nome: 'Chave canivete espiã',
        ficha: 'Minicâmera em formato de chave canivete com resolução de 1080p e bateria de 300 mAh.',
        especialidades: FOTO_VIDEO,
      },
      {
        sku: 'QS-C-002', nome: 'Caneta com câmera espiã',
        ficha: 'Caneta com minicâmera de 1080p e bateria de 480 mAh.',
        especialidades: FOTO_VIDEO,
      },
      {
        sku: 'QS-C-003', nome: 'Óculos com câmera',
        ficha: 'Óculos com minicâmera de 1080p e bateria de 280 mAh.',
        especialidades: FOTO_VIDEO,
      },
    ],
  },
  {
    familia: 'Áudio, vídeo e projeção',
    perfis: [
      lojas('áudio e vídeo', [CNAE_VAREJO_AUDIO_VIDEO]),
      distribuidores('equipamentos de áudio e vídeo', [CNAE_ATACADO_AUDIO_VIDEO]),
      {
        id: 'lojas_games',
        rotulo: 'Lojas de games',
        nicho: 'Games e acessórios para videogame',
        cnaes: [
          { codigo: '4763601', motivo: 'Inclui varejo de jogos eletrônicos e acessórios, além de brinquedos e outros artigos recreativos.', amplo: true },
        ],
        especialidades: [GAMES],
        tipoGoogle: 'varejista',
      },
    ],
    produtos: [
      {
        sku: 'NTV', nome: 'TV Box canais e filmes',
        ficha: 'TV Box para canais e filmes com fonte DC 5 V.',
        nomesAlternativos: ['TV Box'],
        especialidades: ['Streaming e TV', 'Home theater', 'Acessórios para TV'],
      },
      {
        sku: 'QS-T-001', nome: 'Projetor 3 em 1',
        ficha: 'Projetor 3 em 1 acompanhado de dois microfones.',
        especialidades: ESPECIALIDADES_PROJETORES,
      },
      {
        sku: 'QS-T-002', nome: 'Projetor 4 em 1',
        ficha: 'Projetor 4 em 1 acompanhado de dois microfones e dois joysticks.',
        especialidades: ESPECIALIDADES_PROJETORES,
      },
    ],
  },
  {
    familia: 'Informática e armazenamento',
    perfis: [
      VAREJO_INFORMATICA,
      distribuidores('suprimentos de informática', [
        { codigo: '4651602', motivo: 'Representa o atacado de suprimentos de informática para a revenda de cartões de memória.' },
      ]),
    ],
    produtos: [
      {
        sku: '128GB-V', nome: 'Cartão micro SD 128GB',
        ficha: 'Cartão de memória microSD Bodon de 128 GB.',
        especialidades: CARTAO_MEMORIA,
      },
      {
        sku: '32GB-V', nome: 'Cartão micro SD 32GB',
        ficha: 'Cartão de memória microSD Bodon de 32 GB.',
        especialidades: CARTAO_MEMORIA,
      },
      {
        sku: '64GB-V', nome: 'Cartão micro SD 64GB',
        ficha: 'Cartão de memória microSD Bodon de 64 GB.',
        especialidades: CARTAO_MEMORIA,
      },
    ],
  },
  {
    familia: 'Informática e armazenamento',
    perfis: [
      VAREJO_INFORMATICA,
      distribuidores('equipamentos de informática', [
        { codigo: '4651601', motivo: 'Representa o atacado de equipamentos de informática, que inclui periféricos.' },
      ]),
    ],
    produtos: [
      {
        sku: 'MN-TEC', nome: 'Mini teclado',
        ficha: 'Mini teclado Bluetooth com layout QWERTY e área de toque.',
        especialidades: PERIFERICOS,
      },
      {
        sku: 'QS-011', nome: 'Mouse sem fio',
        ficha: 'Mouse sem fio com conexão Bluetooth.',
        especialidades: PERIFERICOS,
      },
    ],
  },
  {
    familia: 'Acessórios para celular',
    perfis: [
      lojas('acessórios para celular', [
        { codigo: '4752100', motivo: 'Abrange revendas de equipamentos de telefonia e comunicação, incluindo acessórios para celulares.', amplo: true },
      ]),
    ],
    produtos: [
      {
        sku: 'QS-010', nome: 'Suporte para celular',
        ficha: 'Suporte para celular em plástico ABS.',
        especialidades: ['Acessórios para smartphone'],
      },
    ],
  },
  {
    familia: 'Utilidades de cozinha',
    perfis: [
      lojas('utilidades domésticas', [
        { codigo: '4759899', motivo: 'Inclui o varejo de artigos de uso doméstico, como utensílios de cozinha.', amplo: true },
      ]),
      distribuidores('utensílios de cozinha', [
        { codigo: '4649499', motivo: 'Inclui atacadistas de artigos para uso doméstico, entre outros segmentos.', amplo: true },
      ], 'atacadista'),
      {
        id: 'armarinhos',
        rotulo: 'Armarinhos com seção de utilidades',
        nicho: 'Armarinhos e utilidades domésticas',
        cnaes: [],
        tipoGoogle: 'varejista',
      },
    ],
    produtos: [
      {
        sku: 'QS-001', nome: 'Colher 5 em 1',
        ficha: 'Colher multifunção de aço 430.',
        especialidades: ['Utensílios de cozinha'],
      },
      {
        sku: 'QS-008', nome: 'Abridor de vinho',
        ficha: 'Abridor de vinho em aço carbono e plástico.',
        especialidades: ['Acessórios para vinho'],
      },
      {
        sku: 'QS-009', nome: 'Utensílio de cozinha 7 em 1',
        ficha: 'Utensílio de cozinha multifunção em aço inox e ABS.',
        especialidades: ['Utensílios de cozinha'],
      },
      {
        sku: 'QS-027', nome: 'Selador térmico 3 em 1',
        ficha: 'Selador térmico de embalagens em plástico.',
        especialidades: ['Embalagem e conservação'],
      },
    ],
  },
  {
    familia: 'Eletroportáteis',
    perfis: [
      lojas('eletroportáteis', [CNAE_VAREJO_AUDIO_VIDEO]),
      distribuidores('eletrodomésticos', [
        { codigo: '4649401', motivo: 'Inclui o atacado de eletrodomésticos, além de outros aparelhos elétricos de uso pessoal e doméstico.', amplo: true },
      ]),
    ],
    produtos: [
      {
        sku: 'QS-031', nome: 'Mini ferro de passar',
        ficha: 'Ferro de passar portátil a vapor de 110 V.',
        nomesAlternativos: ['Ferro a vapor portátil'],
        especialidades: ['Cuidados com roupas'],
      },
      {
        sku: 'QS-032', nome: 'Aspirador de pó sem fio',
        ficha: 'Aspirador sem fio com bateria de 2.200 mAh e reservatório de 1 litro.',
        especialidades: ['Limpeza doméstica'],
      },
    ],
  },
  {
    familia: 'Higiene e bem-estar',
    perfis: [
      lojas('aparelhos de cuidados pessoais', []),
      distribuidores('aparelhos elétricos de uso pessoal', [
        { codigo: '4649401', motivo: 'Inclui atacadistas de aparelhos elétricos de uso pessoal, além de equipamentos de uso doméstico.', amplo: true },
      ]),
    ],
    produtos: [
      {
        sku: 'QS-019', nome: 'Esterilizador de escova',
        ficha: 'Esterilizador em ABS com capacidade para duas escovas de dentes.',
        nomesAlternativos: ['Esterilizador de escovas'],
        especialidades: ['Higiene bucal'],
      },
      {
        sku: 'QS-030', nome: 'Massageador tartaruga',
        ficha: 'Massageador portátil recarregável com três intensidades e bateria de 2.000 mAh.',
        especialidades: ['Aparelhos de cuidados pessoais'],
      },
    ],
  },
  {
    familia: 'Pet',
    perfis: [
      lojas('pet shops', [
        { codigo: '4789004', motivo: 'Cobre pet shops que vendem artigos e alimentos para animais de estimação.' },
      ], 'Pet shops'),
      distribuidores('acessórios pet', [
        { codigo: '4649499', motivo: 'Inclui atacado de artigos para animais de estimação, entre outros artigos de uso pessoal e doméstico.', amplo: true },
      ]),
    ],
    produtos: [
      {
        sku: 'QS-023', nome: 'Garrafa para cachorro de aço',
        ficha: 'Garrafa portátil para cachorro, de aço 304 e silicone, com capacidade de 285 ml.',
        nomesAlternativos: ['Garrafa cachorro de aço', 'Garrafa para cachorro em aço'],
        especialidades: PASSEIO_PET,
      },
      {
        sku: 'QS-023-1', nome: 'Garrafa para cachorro de acrílico',
        ficha: 'Garrafa portátil para cachorro, de acrílico e silicone, com capacidade de 285 ml.',
        nomesAlternativos: ['Garrafa cachorro de acrílico', 'Garrafa para cachorro em acrílico'],
        especialidades: PASSEIO_PET,
      },
      {
        sku: 'QS-026', nome: 'Purificador de ar para dog',
        ficha: 'Purificador de ar da linha pet em ABS com bateria de 3.600 mAh.',
        nomesAlternativos: ['Purificador de ar para cachorro'],
        especialidades: ['Higiene pet'],
      },
    ],
  },
  {
    familia: 'Acessórios automotivos',
    perfis: [
      lojas('acessórios automotivos', [
        { codigo: '4530703', motivo: 'Cobre o varejo de peças e acessórios novos para veículos.' },
      ]),
      distribuidores('acessórios automotivos', [
        { codigo: '4530701', motivo: 'Cobre o atacado de peças e acessórios novos para veículos.' },
      ]),
    ],
    produtos: [
      {
        sku: 'QS-025', nome: 'Bomba de ar portátil',
        ficha: 'Inflador portátil com bateria de 2.000 mAh.',
        nomesAlternativos: ['Inflador portátil'],
        especialidades: ['Infladores e acessórios para pneus'],
      },
      {
        sku: 'QS-028', nome: 'Organizador para carro',
        ficha: 'Organizador veicular em couro de compatibilidade universal.',
        nomesAlternativos: ['Organizador veicular'],
        especialidades: ['Organização veicular'],
      },
    ],
  },
  {
    familia: 'Ferramentas e jardim',
    perfis: [
      lojas('ferramentas', [
        { codigo: '4744001', motivo: 'Representa o comércio varejista de ferragens e ferramentas.' },
      ]),
      distribuidores('ferramentas', [
        { codigo: '4672900', motivo: 'Representa o comércio atacadista de ferragens e ferramentas.' },
      ]),
    ],
    produtos: [
      {
        sku: 'QS-004', nome: 'Mini soprador X8',
        ficha: 'Soprador portátil com seis velocidades e alimentação USB.',
        especialidades: ['Ferramentas portáteis'],
      },
    ],
  },
  {
    familia: 'Ferramentas e jardim',
    perfis: [
      lojas('irrigação e conexões', [
        { codigo: '4744003', motivo: 'Cobre revendas de materiais hidráulicos, como conexões para mangueiras.', amplo: true },
      ]),
      distribuidores('irrigação e conexões', []),
    ],
    produtos: [
      {
        sku: 'QS-007', nome: 'Adaptador de mangueira',
        ficha: 'Adaptador de mangueira em plástico.',
        nomesAlternativos: ['Adaptador mangueira'],
        especialidades: ['Irrigação e conexões'],
      },
    ],
  },
  {
    familia: 'Brinquedos',
    perfis: [
      lojas('brinquedos e jogos', [
        { codigo: '4763601', motivo: 'Representa o varejo de brinquedos e artigos recreativos.' },
      ]),
      distribuidores('brinquedos e jogos', [
        { codigo: '4649499', motivo: 'Inclui o comércio atacadista de brinquedos e artigos recreativos, entre outros segmentos.', amplo: true },
      ]),
    ],
    produtos: [
      {
        sku: 'QS-B-003', nome: 'Bola quebra-cabeça',
        ficha: 'Brinquedo de lógica em formato de bola feito de ABS.',
        especialidades: ['Quebra-cabeças e jogos de lógica'],
      },
    ],
  },
]

function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function normalizarNome(texto: string): string {
  return semAcentos(texto)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\b(?:micro sd|wi fi)\b/g, termo => termo.replace(' ', ''))
    .replace(/\b(\d+) (gb|mp)\b/g, '$1$2')
    .trim()
}

function compactarSku(texto: string): string {
  return texto.toLowerCase().replace(/[\s\p{Dash_Punctuation}]+/gu, '')
}

const INDICE = GRUPOS.flatMap(({ familia, perfis, produtos }) => produtos.map(({ nomesAlternativos = [], ...item }) => {
  const produto: ProdutoProspeccao = { ...item, familia }
  return {
    produto,
    skuCompacto: compactarSku(produto.sku),
    perfis: perfis.flatMap(({ especialidades, ...perfil }) => {
      const compativeis = especialidades
        ? produto.especialidades.filter(especialidade => especialidades.includes(especialidade))
        : produto.especialidades
      return compativeis.length ? [{ ...perfil, especialidades: compativeis }] : []
    }),
    nomes: [produto.nome, ...nomesAlternativos].map(normalizarNome),
  }
})).sort((a, b) => a.produto.sku.localeCompare(b.produto.sku))

const POR_SKU = new Map(INDICE.map(item => [item.produto.sku.toLowerCase(), item]))

export const CATALOGO_PROSPECCAO: readonly ProdutoProspeccao[] = INDICE.map(item => item.produto)

export function obterProdutoProspeccao(sku: string): ProdutoProspeccao | undefined {
  return POR_SKU.get(sku.trim().toLowerCase())?.produto
}

export function perfisDoProduto(produto: ProdutoProspeccao): readonly PerfilProspeccao[] {
  return POR_SKU.get(produto.sku.toLowerCase())?.perfis ?? []
}

export function pesquisarProdutosProspeccao(consulta: string): ProdutoProspeccao[] {
  const nome = normalizarNome(consulta)
  if (!nome) return [...CATALOGO_PROSPECCAO]

  const sku = compactarSku(consulta)
  const termos = nome.split(' ')
  return INDICE.filter(item =>
    item.skuCompacto.includes(sku) ||
    item.nomes.some(opcao => termos.every(termo => opcao.includes(termo))),
  ).map(item => item.produto)
}

export function reconhecerProdutoProspeccao(consulta: string): ProdutoProspeccao | undefined {
  const termos = semAcentos(consulta).replace(/\p{Dash_Punctuation}/gu, '-')
    .match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) ?? []
  const skuInvalido = termos.some((termo, indice) => {
    const codigo = termos[indice + 1]
    return termo === 'sku' && codigo && /\d/.test(codigo) && !POR_SKU.has(codigo)
  })
  if (skuInvalido) return undefined

  const skus = new Set(termos)
  const frase = ` ${normalizarNome(consulta)} `
  const encontrados = INDICE.filter(item =>
    skus.has(item.produto.sku.toLowerCase()) || item.nomes.some(nome => frase.includes(` ${nome} `)),
  )
  return encontrados.length === 1 ? encontrados[0].produto : undefined
}
