import { describe, expect, test } from 'vitest'
import { bancoInicial, type FiltrosBanco } from './banco-empresas'
import { prepararAplicacaoSugestaoBanco, type SelecaoPerfilBanco, type SugestaoBanco } from './assistente-ia-banco'
import { prepararConsultaCasa } from '@/src/server/casa-dados/filtros'

const sugestao: SugestaoBanco = {
  titulo: 'Lojas de games',
  descricao: 'Revenda de eletrônicos.',
  cnaes: [{ codigo: '4763601', descricao: 'Varejo de brinquedos e artigos recreativos' }],
  perfilEmpresa: {
    portes: { valor: ['ME', 'EPP'], motivo: 'Pequenos varejistas.' },
    mei: { valor: 'excluir', motivo: 'Campanha de revenda em volume.' },
    regime: { valor: 'simples', motivo: 'Recorte opcional da campanha.' },
    estabelecimento: { valor: 'matriz', motivo: 'Contato com o decisor.' },
    aberturaUltimosDias: { valor: 365, motivo: 'Empresas recentes.' },
    contato: { valor: 'celular', motivo: 'Contato móvel disponível.' },
  },
}

function preparar(atual: FiltrosBanco, selecao: SelecaoPerfilBanco, opcao = sugestao) {
  const resultado = prepararAplicacaoSugestaoBanco(atual, opcao, selecao)
  expect(resultado.ok).toBe(true)
  if (!resultado.ok) throw new Error(resultado.motivo)
  return resultado
}

describe('perfil de comprador no Banco', () => {
  test('aplica apenas CNAE quando nenhum filtro opcional ou capital for escolhido', () => {
    const atual = { ...bancoInicial(), portes: ['DEMAIS'] as const, capitalMinimo: '1000', capitalMaximo: '100000' }
    const { campos } = preparar({ ...atual, portes: [...atual.portes] }, { campos: [], capitalMinimo: '', capitalMaximo: '' })
    expect(campos).toEqual({ cnaes: ['4763601'] })
  })

  test('traduz o perfil aprovado e o capital digitado para o payload da Casa dos Dados', () => {
    const atual: FiltrosBanco = {
      ...bancoInicial(), palavras: ['varejo'], ddds: ['11'], tipos: ['1'], situacoes: ['ativa'],
      aberturaDe: '2021-01-01', excluirSimples: true, simplesExclusaoDe: '2024-01-01',
      regioes: [{ estado: 'SP', cidade: 'Campinas', bairros: [] }],
    }
    const aplicacao = preparar(atual, {
      campos: ['portes', 'mei', 'regime', 'estabelecimento', 'aberturaUltimosDias', 'contato'],
      capitalMinimo: '20000', capitalMaximo: '100000',
    })
    expect(aplicacao.substituicoes).toEqual(expect.arrayContaining(['Estabelecimento', 'Período de abertura', 'Regime tributário']))
    const filtros = { ...atual, ...aplicacao.campos }
    expect(filtros).toMatchObject({ excluirSimples: false, simplesExclusaoDe: '', aberturaDe: '', aberturaAte: '', regioes: atual.regioes, ddds: atual.ddds })
    expect(prepararConsultaCasa({
      palavra: '', cnae: '', uf: '', cidade: '', bairro: '', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 20, offset: 0,
      avancados: filtros,
    })).toMatchObject({ ok: true, pedido: {
      codigo_atividade_principal: ['4763601'], municipio: ['campinas'], porte_empresa: { codigos: ['01', '03'] },
      mei: { excluir_optante: true }, simples: { optante: true }, capital_social: { minimo: 20000, maximo: 100000 },
      matriz_filial: 'MATRIZ', data_abertura: { ultimos_dias: 365 }, mais_filtros: { com_telefone: true, somente_celular: true },
    } })
  })

  test('somente MEI substitui portes e datas de exclusão após seleção explícita', () => {
    const atual: FiltrosBanco = { ...bancoInicial(), portes: ['EPP'], excluirMei: true, meiExclusaoAte: '2025-01-01' }
    const opcao: SugestaoBanco = { ...sugestao, perfilEmpresa: { ...sugestao.perfilEmpresa, mei: { valor: 'somente', motivo: 'Campanha para microempreendedores.' } } }
    const escolha = preparar(atual, { campos: ['mei'] }, opcao)
    expect(escolha.campos).toMatchObject({ portes: ['MEI'], excluirMei: false, meiExclusaoAte: '' })
    expect(escolha.substituicoes).toEqual(expect.arrayContaining(['Porte', 'Exclusão de MEI']))
    expect(prepararAplicacaoSugestaoBanco(atual, opcao, { campos: ['portes', 'mei'] })).toMatchObject({ ok: false, motivo: expect.stringContaining('MEI') })
  })

  test('trocar para qualquer MEI ou regime limpa os critérios antigos desses grupos', () => {
    const atual: FiltrosBanco = { ...bancoInicial(), portes: ['MEI'], excluirSimples: true, simplesExclusaoAte: '2025-01-01' }
    const opcao: SugestaoBanco = { ...sugestao, perfilEmpresa: {
      mei: { valor: 'qualquer', motivo: 'Busca ampla.' }, regime: { valor: 'qualquer', motivo: 'Busca ampla.' },
    } }
    expect(preparar(atual, { campos: ['mei', 'regime'] }, opcao).campos).toMatchObject({
      portes: [], excluirMei: false, regimes: [], excluirSimples: false, simplesExclusaoAte: '',
    })
  })

  test('valida MEI e Simples em conjunto com os filtros já preenchidos', () => {
    const opcao: SugestaoBanco = { ...sugestao, perfilEmpresa: {
      mei: { valor: 'somente', motivo: 'Campanha voltada a microempreendedores.' },
      regime: { valor: 'fora_simples', motivo: 'Recorte cadastral da campanha.' },
    } }
    const cenarios = [
      { atual: bancoInicial(), campos: ['mei', 'regime'] as const },
      { atual: { ...bancoInicial(), excluirSimples: true }, campos: ['mei'] as const },
      { atual: { ...bancoInicial(), portes: ['MEI'] as FiltrosBanco['portes'] }, campos: ['regime'] as const },
    ]
    for (const { atual, campos } of cenarios) {
      expect(prepararAplicacaoSugestaoBanco(atual, opcao, { campos: [...campos] })).toMatchObject({
        ok: false, motivo: expect.stringContaining('Fora do Simples Nacional'),
      })
    }
    expect(preparar(bancoInicial(), { campos: ['mei'] }, opcao).campos).toMatchObject({ portes: ['MEI'] })
  })

  test('preserva períodos de exclusão quando a sugestão mantém as mesmas exclusões', () => {
    const atual: FiltrosBanco = {
      ...bancoInicial(), excluirMei: true, meiExclusaoAte: '2025-01-01',
      excluirSimples: true, simplesExclusaoDe: '2024-01-01',
    }
    const opcao: SugestaoBanco = { ...sugestao, perfilEmpresa: {
      mei: { valor: 'excluir', motivo: 'Segmentação de MEI.' },
      regime: { valor: 'fora_simples', motivo: 'Segmentação de regime.' },
    } }
    const resultado = preparar(atual, { campos: ['mei', 'regime'] }, opcao)
    expect({ ...atual, ...resultado.campos }).toMatchObject({
      excluirMei: true, meiExclusaoAte: '2025-01-01',
      excluirSimples: true, simplesExclusaoDe: '2024-01-01',
    })
    expect(resultado.substituicoes).toEqual([])
  })

  test.each([
    { capitalMinimo: '10.5' }, { capitalMinimo: '-10' }, { capitalMaximo: '1e6' },
    { capitalMinimo: '10000000000000' }, { capitalMinimo: '60000' },
  ])('bloqueia capital inválido ou acima de um máximo preservado (%j)', capital => {
    const atual = { ...bancoInicial(), capitalMaximo: '50000' }
    expect(prepararAplicacaoSugestaoBanco(atual, sugestao, { campos: [], ...capital })).toMatchObject({
      ok: false, motivo: expect.stringMatching(/capital/i),
    })
  })

  test('aplica só o limite digitado quando o outro já está preenchido', () => {
    const atual = { ...bancoInicial(), capitalMaximo: '50000' }
    expect(preparar(atual, { campos: [], capitalMinimo: '20000', capitalMaximo: '' }).campos).toEqual({
      cnaes: ['4763601'], capitalMinimo: '20000',
    })
  })

  test('preserva a escrita de um valor inteiro existente com duas casas decimais', () => {
    const atual = { ...bancoInicial(), capitalMaximo: '50000.00' }
    const { campos } = preparar(atual, { campos: [], capitalMinimo: '20000' })
    expect({ ...atual, ...campos }).toMatchObject({ capitalMinimo: '20000', capitalMaximo: '50000.00' })
  })
})
