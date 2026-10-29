import { expect, test } from 'vitest'
import { analisarPlanilha, CABECALHO_GOOGLE } from '../../features/empresas/planilha'
import { lerColetaSheets } from './entrada-sheets'
import { classificarConsultaComunidade } from './whatsapp'
import { COLUNAS_CRM, montarSaidas, serializarCsvCrm } from './exportar-crm'
import type { SaidasSimples } from './simples-modelo'

function executar(cabecalho: string[], linhas: string[][], invalidos: string[] = []): SaidasSimples {
  const leitura = lerColetaSheets([cabecalho, ...linhas])
  if (!leitura.ok) throw new Error(leitura.motivo)
  const consultas = classificarConsultaComunidade(leitura.coleta.numeros, {
    success: true, data: leitura.coleta.numeros.map(number => ({ number, exists: !invalidos.includes(number) })),
  }, true, '2026-10-15T12:00:00.000Z')
  const resultado = montarSaidas(leitura.coleta, consultas)
  if (!resultado.ok) throw new Error(resultado.motivo)
  if (resultado.saidas.exportacao.length) {
    const analise = analisarPlanilha(new TextEncoder().encode(serializarCsvCrm(resultado.saidas.exportacao)))
    expect(analise).toMatchObject({ ok: true, recusadas: [] })
    if (!analise.ok) throw new Error(analise.falha.motivo)
    expect(analise.aceitas).toHaveLength(resultado.saidas.exportacao.length)
  }
  return resultado.saidas
}

const telefone = '+55 11 2600-0001'
const numero = '551126000001'
const cabecalho = ['telefone', 'nome_empresa', 'place_id']

test('exporta prospect sem CNPJ com telefone nacional e Place ID', () => {
  const saidas = executar([...cabecalho, 'cep'], [[telefone, 'Empresa do cenário', 'ChIJ-cenario-a', '01310-100']])
  expect(COLUNAS_CRM.join(',')).toBe(CABECALHO_GOOGLE)
  expect(saidas.exportacao).toEqual([['', '', 'Empresa do cenário', '', '1126000001', '', '01310100', '', 'ChIJ-cenario-a']])
  expect(saidas.validos).toEqual([numero])
  expect(saidas.invalidos).toEqual([])
})

test.each([
  [['telefone'], [[telefone]], 'identidade_ausente'],
  [cabecalho, [[telefone, '', 'ChIJ-a']], 'nome_ausente'],
  [cabecalho, [[telefone, 'Empresa', '']], 'identidade_ausente'],
  [[...cabecalho, 'cnpj'], [[telefone, 'Empresa', 'ChIJ-a', '11222333000100']], 'cnpj_invalido'],
  [[...cabecalho, 'email'], [[telefone, 'Empresa', 'ChIJ-a', 'invalido']], 'email_forma'],
  [[...cabecalho, 'cep'], [[telefone, 'Empresa', 'ChIJ-a', '1310100']], 'cep_forma'],
  [[...cabecalho, 'cnae_principal'], [[telefone, 'Empresa', 'ChIJ-a', '4742/3-00']], 'cnae_forma'],
  [cabecalho, [[telefone, 'Empresa\nquebrada', 'ChIJ-a']], 'caractere_invalido'],
  [cabecalho, [[telefone, 'Empresa\u0000', 'ChIJ-a']], 'caractere_invalido'],
  [cabecalho, [[telefone, 'Empresa', 'ChIJ\u0085a']], 'caractere_invalido'],
  [cabecalho, [[telefone, 'Empresa', 'a'.repeat(256)]], 'google_place_id_invalido'],
  [[...cabecalho, 'nome_fantasia'], [[telefone, 'Empresa', 'ChIJ-a', 'Outra']], 'aliases_divergentes'],
  [[...cabecalho, 'google_place_id'], [[telefone, 'Empresa', 'ChIJ-a', 'ChIJ-b']], 'aliases_divergentes'],
])('mantém cadastro inadequado pendente (%s)', (colunas, linhas, motivo) => {
  const saidas = executar(colunas as string[], linhas as string[][])
  expect(saidas.exportacao).toEqual([])
  expect(saidas.validos).toEqual([numero])
  expect(saidas.invalidos).toEqual([])
  expect(saidas.pendencias).toEqual([expect.objectContaining({ linhas: [2], numero, motivo })])
})

test('conta duas ocorrências de pendência para uma única empresa sem telefone e identidade', () => {
  const leitura = lerColetaSheets([
    [...cabecalho, 'bairro', 'cidade', 'uf', 'data_coleta'],
    ['', '', '', 'Brás', 'São Paulo', 'SP', '2026-10-16'],
  ])
  expect(leitura.ok).toBe(true)
  if (!leitura.ok) throw new Error(leitura.motivo)
  expect(leitura.coleta.linhas).toHaveLength(1)
  const resultado = montarSaidas(leitura.coleta, [])
  expect(resultado).toEqual({ ok: true, saidas: {
    validos: [], invalidos: [], exportacao: [], compartilhados: [], duplicadas: [],
    pendencias: [
      { linhas: [2], numero: null, motivo: 'telefone_ausente' },
      { linhas: [2], numero: null, motivo: 'identidade_ausente' },
    ],
  } })
  if (!resultado.ok) throw new Error(resultado.motivo)
  expect(serializarCsvCrm(resultado.saidas.exportacao).trim().split('\n')).toHaveLength(1)
})

test('normaliza CNPJ, CEP, CNAE e e-mail e preserva razão social independente', () => {
  const saidas = executar(['telefone', 'cnpj', 'razao_social', 'cep', 'cnae_principal', 'email'], [
    [telefone, '11.222.333/0001-81', 'Empresa jurídica', '01310-100', '4742-3/00', ' CONTATO@EMPRESA.COM '],
  ])
  expect(saidas.exportacao).toEqual([['11222333000181', 'Empresa jurídica', '', '', '1126000001', 'contato@empresa.com', '01310100', '4742300', '']])
})

test('preserva aspas, vírgulas e nome literal iniciado por igual', () => {
  const saidas = executar(cabecalho, [[telefone, '=Empresa, "literal"', 'ChIJ-a']])
  expect(saidas.exportacao[0][2]).toBe('=Empresa, "literal"')
  expect(serializarCsvCrm(saidas.exportacao)).toContain('"=Empresa, ""literal"""')
})

test('aceita aliases iguais após trim e Place ID com 255 pontos de código', () => {
  const place = '😀'.repeat(255)
  const saidas = executar([...cabecalho, 'nome_fantasia', 'google_place_id'], [
    [telefone, ' Empresa ', ` ${place} `, 'Empresa', place],
  ])
  expect(saidas.exportacao[0][8]).toBe(place)
  expect(saidas.pendencias).toEqual([])
})

test('deduplica cadastro idêntico sem fundir empresas distintas com telefone compartilhado', () => {
  const saidas = executar(cabecalho, [
    [telefone, 'Empresa A', 'ChIJ-a'], [telefone, ' Empresa A ', 'ChIJ-a'], [telefone, 'Empresa B', 'ChIJ-b'],
  ])
  expect(saidas.exportacao).toHaveLength(2)
  expect(saidas.validos).toEqual([numero])
  expect(saidas.duplicadas).toEqual([3])
  expect(saidas.compartilhados).toEqual([{ numero, linhas: [2, 4] }])
})

test('bloqueia todas as ocorrências de identidades divergentes ligadas em cadeia', () => {
  const saidas = executar([...cabecalho, 'cnpj'], [
    [telefone, 'Empresa A', 'ChIJ-a', '11222333000181'],
    [telefone, 'Empresa A', 'ChIJ-b', '11222333000181'],
    [telefone, 'Empresa B', 'ChIJ-b', '04252011000110'],
    [telefone, 'Empresa B', 'ChIJ-b', '04252011000110'],
  ])
  expect(saidas.exportacao).toEqual([])
  expect(saidas.duplicadas).toEqual([])
  expect(saidas.pendencias).toEqual([expect.objectContaining({ linhas: [2, 3, 4, 5], motivo: 'identidade_divergente' })])
})

test('não escolhe linha válida antes de considerar divergência com cadastro inválido', () => {
  const saidas = executar([...cabecalho, 'email'], [
    [telefone, 'Empresa A', 'ChIJ-a', 'contato@empresa.com'],
    [telefone, 'Empresa A', 'ChIJ-a', 'invalido'],
  ])
  expect(saidas.exportacao).toEqual([])
  expect(saidas.pendencias.some(p => p.linhas.includes(2))).toBe(true)
  expect(saidas.pendencias.some(p => p.linhas.includes(3))).toBe(true)
})

test('separa negativos confirmados e mantém pendências de entrada com linhas originais', () => {
  const saidas = executar(cabecalho, [
    [telefone, 'Empresa A', 'ChIJ-a'], ['', '', ''],
    ['11 2600-0002', 'Empresa B', 'ChIJ-b'], ['sem telefone', 'Empresa C', 'ChIJ-c'],
  ], ['551126000002'])
  expect(saidas.validos).toEqual([numero])
  expect(saidas.invalidos).toEqual(['551126000002'])
  expect(saidas.exportacao).toHaveLength(1)
  expect(saidas.pendencias).toContainEqual({ linhas: [5], numero: null, motivo: 'telefone_invalido' })
})

test.each(['ausente', 'duplicada', 'extra', 'inconclusiva', 'pendente', 'numero_divergente', 'revalidar'])(
  'bloqueia publicação de consulta %s', caso => {
    const leitura = lerColetaSheets([cabecalho, [telefone, 'Empresa A', 'ChIJ-a']])
    if (!leitura.ok) throw new Error(leitura.motivo)
    const consultas = classificarConsultaComunidade([numero], {
      success: true, data: [{ number: numero, exists: true }],
    }, true, '2026-10-15T12:00:00.000Z')
    if (caso === 'ausente') consultas.pop()
    if (caso === 'duplicada') consultas.push({ ...consultas[0] })
    if (caso === 'extra') consultas.push({ ...consultas[0], numero: '551126000002', numeroRetornado: '551126000002' })
    if (caso === 'inconclusiva') consultas[0].estado = 'inconclusivo'
    if (caso === 'pendente') consultas[0].estado = 'pendente'
    if (caso === 'numero_divergente') consultas[0].numeroRetornado = '551126000002'
    if (caso === 'revalidar') consultas[0].revalidar = true
    expect(montarSaidas(leitura.coleta, consultas)).toMatchObject({ ok: false, motivo: 'consulta_incompleta' })
  },
)

test('exportação sem válidos e coleta vazia geram somente o cabeçalho', () => {
  for (const saidas of [executar(cabecalho, []), executar(cabecalho, [[telefone, 'Empresa', 'ChIJ-a']], [numero])]) {
    expect(saidas.exportacao).toEqual([])
    expect(serializarCsvCrm(saidas.exportacao)).toBe('"cnpj","razao_social","nome_fantasia","contato_nome","telefone","email","cep","cnae_principal","google_place_id"\n')
  }
})
test('revisa identidade divergente mesmo quando uma ocorrência não tem WhatsApp', () => {
  const saidas = executar(cabecalho, [
    [telefone, 'Empresa A', 'ChIJ-a'], ['11 2600-0002', 'Empresa A', 'ChIJ-a'],
  ], ['551126000002'])
  expect(saidas.validos).toEqual([numero])
  expect(saidas.invalidos).toEqual(['551126000002'])
  expect(saidas.exportacao).toEqual([])
  expect(saidas.pendencias).toEqual([{ linhas: [2, 3], numero: null, motivo: 'identidade_divergente' }])
})

test('CNPJ inválido repetido não une identidades Place ID distintas', () => {
  const saidas = executar([...cabecalho, 'cnpj'], [
    [telefone, 'Empresa A', 'ChIJ-a', '11222333000100'],
    [telefone, 'Empresa B', 'ChIJ-b', '11222333000100'],
  ])
  expect(saidas.exportacao).toEqual([])
  expect(saidas.pendencias).toEqual([
    { linhas: [2], numero, motivo: 'cnpj_invalido' },
    { linhas: [3], numero, motivo: 'cnpj_invalido' },
  ])
})

test('Place ID inválido repetido não une cadastros com CNPJ distintos', () => {
  const saidas = executar([...cabecalho, 'cnpj'], [
    [telefone, 'Empresa A', 'x'.repeat(256), '11222333000181'],
    [telefone, 'Empresa B', 'x'.repeat(256), '04252011000110'],
  ])
  expect(saidas.pendencias).toEqual([
    { linhas: [2], numero, motivo: 'google_place_id_invalido' },
    { linhas: [3], numero, motivo: 'google_place_id_invalido' },
  ])
})

test('aliases Place ID divergentes ligam todas as ocorrências válidas do componente', () => {
  const saidas = executar([...cabecalho, 'google_place_id'], [
    [telefone, 'Empresa A', 'ChIJ-a', ''],
    [telefone, 'Empresa A', 'ChIJ-a', 'ChIJ-b'],
    [telefone, 'Empresa B', '', 'ChIJ-b'],
  ])
  expect(saidas.exportacao).toEqual([])
  expect(saidas.pendencias).toEqual([{ linhas: [2, 3, 4], numero, motivo: 'identidade_divergente' }])
})

test('deduplica por campos exportáveis normalizados e ignora endereço e link extras', () => {
  const saidas = executar(['telefone', 'cnpj', 'razao_social', 'cep', 'cnae_principal', 'endereco', 'link_maps'], [
    [telefone, '11.222.333/0001-81', 'Empresa', '01310-100', '4742-3/00', 'Rua A', 'url-a'],
    ['1126000001', '11222333000181', ' Empresa ', '01310100', '4742300', 'Rua B', 'url-b'],
  ])
  expect(saidas.exportacao).toHaveLength(1)
  expect(saidas.duplicadas).toEqual([3])
  expect(saidas.pendencias).toEqual([])
})

test.each(['nome_empresa', 'nome_fantasia', 'razao_social', 'contato_nome', 'email', 'cep', 'cnae_principal', 'google_place_id'])(
  'não apaga controles ao aparar o campo %s', campo => {
    const colunas = ['telefone', 'place_id', 'nome_empresa', ...campo === 'nome_empresa' ? [] : [campo]]
    const linha = [telefone, 'ChIJ-a', campo === 'nome_empresa' ? 'Empresa\r' : 'Empresa', ...campo === 'nome_empresa' ? [] : ['\t']]
    const saidas = executar(colunas, [linha])
    expect(saidas.exportacao).toEqual([])
    expect(saidas.pendencias).toEqual([{ linhas: [2], numero, motivo: 'caractere_invalido' }])
  },
)

test('coleta somente com telefone de entrada inválido publica listas vazias e pendência', () => {
  const saidas = executar(cabecalho, [['sem número', 'Empresa A', 'ChIJ-a']])
  expect(saidas.validos).toEqual([])
  expect(saidas.invalidos).toEqual([])
  expect(saidas.exportacao).toEqual([])
  expect(saidas.pendencias).toEqual([{ linhas: [2], numero: null, motivo: 'telefone_invalido' }])
})
test('Place ID com controle aparável não cria vínculo com identidade válida', () => {
  const saidas = executar([...cabecalho, 'cnpj'], [
    [telefone, 'Empresa A', 'ChIJ-a', '11222333000181'],
    [telefone, 'Empresa B', '\tChIJ-a', '04252011000110'],
  ])
  expect(saidas.exportacao).toHaveLength(1)
  expect(saidas.exportacao[0][0]).toBe('11222333000181')
  expect(saidas.pendencias).toEqual([{ linhas: [3], numero, motivo: 'caractere_invalido' }])
})

test('reporta telefone compartilhado com cadastro pendente e deduplica suas ocorrências idênticas', () => {
  const saidas = executar([...cabecalho, 'email'], [
    [telefone, 'Empresa A', 'ChIJ-a', 'contato@empresa.com'],
    [telefone, 'Empresa B', 'ChIJ-b', 'invalido'],
    [telefone, 'Empresa B', 'ChIJ-b', 'invalido'],
  ])
  expect(saidas.validos).toEqual([numero])
  expect(saidas.exportacao).toHaveLength(1)
  expect(saidas.exportacao[0][8]).toBe('ChIJ-a')
  expect(saidas.pendencias).toEqual([{ linhas: [3, 4], numero, motivo: 'email_forma' }])
  expect(saidas.compartilhados).toEqual([{ numero, linhas: [2, 3] }])
})

test('reporta compartilhamento entre empresas identificadas mesmo quando ambas estão pendentes', () => {
  const saidas = executar([...cabecalho, 'email'], [
    [telefone, 'Empresa A', 'ChIJ-a', 'invalido'],
    [telefone, 'Empresa B', 'ChIJ-b', 'invalido'],
  ])
  expect(saidas.exportacao).toEqual([])
  expect(saidas.pendencias).toHaveLength(2)
  expect(saidas.compartilhados).toEqual([{ numero, linhas: [2, 3] }])
})

test('reporta cada telefone de componente divergente compartilhado com outra identidade', () => {
  const saidas = executar(cabecalho, [
    [telefone, 'Empresa A', 'ChIJ-a'],
    ['11 2600-0002', 'Empresa A', 'ChIJ-a'],
    ['11 2600-0002', 'Empresa B', 'ChIJ-b'],
  ])
  expect(saidas.exportacao).toHaveLength(1)
  expect(saidas.pendencias).toEqual([{ linhas: [2, 3], numero: null, motivo: 'identidade_divergente' }])
  expect(saidas.compartilhados).toEqual([{ numero: '551126000002', linhas: [3, 4] }])
})

test('não considera cadastro sem identidade como outra empresa no compartilhamento', () => {
  const saidas = executar(cabecalho, [
    [telefone, 'Empresa A', 'ChIJ-a'], [telefone, 'Sem identidade', ''],
  ])
  expect(saidas.exportacao).toHaveLength(1)
  expect(saidas.pendencias).toEqual([{ linhas: [3], numero, motivo: 'identidade_ausente' }])
  expect(saidas.compartilhados).toEqual([])
})


test.each(['ascii', 'unicode', 'aspas'])('bloqueia CSV acima do orçamento real do importador: %s', async caso => {
  const { analisarArquivo } = await import('../../features/empresas/arquivo')
  const nome = caso === 'ascii' ? 'a'.repeat(149) : (caso === 'unicode' ? 'é' : '"').repeat(140)
  const linhas = Array.from({ length: 5000 }, (_, i) =>
    [telefone, nome, 'p' + i, caso === 'ascii' ? 'r'.repeat(129) : '', caso === 'ascii' ? 'c'.repeat(39) : '', 'contato@empresa.test'])
  const leitura = lerColetaSheets([[...cabecalho, 'razao_social', 'contato_nome', 'email'], ...linhas])
  if (!leitura.ok) throw new Error(leitura.motivo)
  const consultas = classificarConsultaComunidade([numero], {
    success: true, data: [{ number: numero, exists: true }],
  }, true, '2026-10-15T12:00:00.000Z')
  const csv = serializarCsvCrm(linhas.map(l => ['', l[3], l[1], l[4], '1126000001', l[5], '', '', l[2]]))
  expect(await analisarArquivo(new TextEncoder().encode(csv))).toMatchObject({ ok: false, falha: { motivo: 'excede_tamanho' } })
  const r = montarSaidas(leitura.coleta, consultas)
  expect(r).toMatchObject({ ok: false, motivo: 'exportacao_excede_tamanho', limiteBytes: 1500000 })
  expect(r).not.toHaveProperty('saidas')
  expect(JSON.stringify(r)).toContain('Divida a coleta')
  expect(leitura.coleta.linhas).toHaveLength(5000)
})

test('CSV aceito com Unicode, aspas e vírgulas passa por analisarArquivo inclusive com BOM e CRLF', async () => {
  const { analisarArquivo } = await import('../../features/empresas/arquivo')
  const saidas = executar(cabecalho, Array.from({ length: 1000 }, (_, i) =>
    [telefone, 'São Paulo, "Café 😀"', 'p' + i]))
  const csv = '\uFEFF' + serializarCsvCrm(saidas.exportacao).replace(/\n/g, '\r\n')
  const analise = await analisarArquivo(new TextEncoder().encode(csv))
  expect(analise).toMatchObject({ ok: true, recusadas: [] })
  if (!analise.ok) throw new Error(analise.falha.motivo)
  expect(analise.aceitas).toHaveLength(1000)
})


test.each([1500000, 1500001])('reserva BOM e CRLF no limite de %i bytes sem truncar', async tamanho => {
  const { analisarArquivo } = await import('../../features/empresas/arquivo')
  const linhas = Array.from({ length: 5000 }, (_, i) => [telefone, 'a'.repeat(250), 'p' + String(i).padStart(4, '0'), ''])
  const csvReferencia = () => '\uFEFF"cnpj","razao_social","nome_fantasia","contato_nome","telefone","email","cep","cnae_principal","google_place_id"\r\n'
    + linhas.map(l => '"","' + l[3] + '","' + l[1] + '","","1126000001","","","","' + l[2] + '"\r\n').join('')
  const faltam = tamanho - Buffer.byteLength(csvReferencia())
  linhas.forEach((l, i) => { l[3] = 'r'.repeat(Math.floor(faltam / linhas.length) + (i < faltam % linhas.length ? 1 : 0)) })
  const bytes = new TextEncoder().encode(csvReferencia())
  expect(bytes.byteLength).toBe(tamanho)
  const leitura = lerColetaSheets([[...cabecalho, 'razao_social'], ...linhas])
  if (!leitura.ok) throw new Error(leitura.motivo)
  const consultas = classificarConsultaComunidade([numero], { success: true, data: [{ number: numero, exists: true }] }, true, '2026-10-15')
  const r = montarSaidas(leitura.coleta, consultas)
  const analise = await analisarArquivo(bytes)
  if (tamanho === 1500000) {
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error(r.motivo)
    expect(r.saidas.exportacao).toHaveLength(5000)
    expect(analise).toMatchObject({ ok: true, recusadas: [] })
    if (!analise.ok) throw new Error(analise.falha.motivo)
    expect(analise.aceitas).toHaveLength(5000)
  } else {
    expect(r).toMatchObject({ ok: false, motivo: 'exportacao_excede_tamanho', bytesEstimados: tamanho })
    expect(analise).toMatchObject({ ok: false, falha: { motivo: 'excede_tamanho' } })
  }
})
