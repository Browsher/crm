import { normalizarCep } from '../cep'
import { normalizarCnae } from '../cnae'
import { normalizarCnpj, validarCnpj } from '../cnpj'
import type { TelefoneBase } from './modelo'
import type { ColetaSheets, LinhaScraping, PendenciaSimples, ResultadoSimples, SaidasSimples } from './simples-modelo'

export const COLUNAS_CRM = [
  'cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'telefone',
  'email', 'cep', 'cnae_principal', 'google_place_id',
] as const

const CONTROLE = /[\u0000-\u001f\u007f-\u009f]/
const EMAIL = /^[^\s@]+@[^\s@]+$/

type Cadastro = {
  origem: LinhaScraping
  campos: string[]
  identidades: string[]
  motivo: string | null
}

function placeValido(valor: string): boolean {
  return valor !== '' && [...valor].length <= 255 && !CONTROLE.test(valor)
}

function prepararCadastro(origem: LinhaScraping): Cadastro {
  const dados = origem.dados
  const valor = (nome: string) => (dados[nome] ?? '').trim()
  const cnpjBruto = valor('cnpj')
  const cnpj = normalizarCnpj(cnpjBruto)
  const cnpjValido = cnpj !== null && validarCnpj(cnpj)
  const place = valor('google_place_id') || valor('place_id')
  const fantasia = valor('nome_fantasia') || valor('nome_empresa')
  const cep = valor('cep') ? normalizarCep(valor('cep')) : ''
  const cnae = normalizarCnae(valor('cnae_principal'))
  const campos = [
    cnpj ?? cnpjBruto, valor('razao_social'), fantasia, valor('contato_nome'),
    origem.numero?.slice(2) ?? valor('telefone'), valor('email').toLowerCase(),
    cep ?? valor('cep'), cnae.ok ? cnae.valor ?? '' : valor('cnae_principal'), place,
  ]
  // Somente identificadores válidos ligam empresas. Em conflito de aliases,
  // ambos os Place IDs válidos participam para que nenhuma linha escape da revisão.
  const identidades = [
    ...(cnpjValido ? ['cnpj:' + cnpj] : []),
    ...['place_id', 'google_place_id'].flatMap(nome => placeValido(valor(nome)) && !CONTROLE.test(dados[nome] ?? '')
      ? ['place:' + valor(nome)] : []),
  ]
  let motivo: string | null = null
  if (['nome_empresa', 'nome_fantasia', 'place_id', 'google_place_id', ...COLUNAS_CRM]
    .some(nome => CONTROLE.test(dados[nome] ?? ''))) motivo = 'caractere_invalido'
  else if (valor('nome_empresa') && valor('nome_fantasia') && valor('nome_empresa') !== valor('nome_fantasia')
    || valor('place_id') && valor('google_place_id') && valor('place_id') !== valor('google_place_id')) motivo = 'aliases_divergentes'
  else if (cnpjBruto && !cnpjValido) motivo = 'cnpj_invalido'
  else if (place && !placeValido(place)) motivo = 'google_place_id_invalido'
  else if (!cnpjValido && !place) motivo = 'identidade_ausente'
  else if (!campos[1] && !fantasia) motivo = 'nome_ausente'
  else if (campos[5] && !EMAIL.test(campos[5])) motivo = 'email_forma'
  else if (cep === null) motivo = 'cep_forma'
  else if (!cnae.ok) motivo = 'cnae_forma'
  return { origem, campos, identidades, motivo }
}

function agruparIdentidades(cadastros: Cadastro[]): Cadastro[][] {
  const pais = cadastros.map((_, indice) => indice)
  const raiz = (indice: number): number => {
    while (pais[indice] !== indice) {
      pais[indice] = pais[pais[indice]]
      indice = pais[indice]
    }
    return indice
  }
  const porIdentidade = new Map<string, number>()
  cadastros.forEach((cadastro, indice) => {
    for (const identidade of cadastro.identidades) {
      const anterior = porIdentidade.get(identidade)
      if (anterior !== undefined) pais[raiz(indice)] = raiz(anterior)
      else porIdentidade.set(identidade, indice)
    }
  })
  const grupos = new Map<number, Cadastro[]>()
  cadastros.forEach((cadastro, indice) => {
    const chave = raiz(indice)
    const grupo = grupos.get(chave) ?? []
    grupo.push(cadastro)
    grupos.set(chave, grupo)
  })
  return [...grupos.values()]
}

function conferirConsultas(coleta: ColetaSheets, consultas: TelefoneBase[]): PendenciaSimples[] {
  const esperados = new Set(coleta.numeros)
  const porNumero = new Map<string, TelefoneBase[]>()
  for (const consulta of consultas) {
    const grupo = porNumero.get(consulta.numero) ?? []
    grupo.push(consulta)
    porNumero.set(consulta.numero, grupo)
  }
  const pendencias: PendenciaSimples[] = []
  for (const numero of new Set([...esperados, ...porNumero.keys()])) {
    const grupo = porNumero.get(numero) ?? []
    const consulta = grupo[0]
    if (esperados.has(numero) && grupo.length === 1 && !consulta.revalidar
      && consulta.numeroRetornado === numero
      && (consulta.estado === 'encontrado' || consulta.estado === 'nao_encontrado')) continue
    pendencias.push({
      linhas: coleta.linhas.filter(linha => linha.numero === numero).map(linha => linha.linha),
      numero,
      motivo: !esperados.has(numero) ? 'consulta_extra' : grupo.length > 1 ? 'consulta_duplicada'
        : consulta?.motivo ?? 'consulta_incompleta',
    })
  }
  return pendencias
}

export function montarSaidas(coleta: ColetaSheets, consultas: TelefoneBase[]): ResultadoSimples {
  const consultasPendentes = conferirConsultas(coleta, consultas)
  if (consultasPendentes.length) {
    return { ok: false, motivo: 'consulta_incompleta', pendencias: [...coleta.pendencias, ...consultasPendentes] }
  }
  const estados = new Map(consultas.map(consulta => [consulta.numero, consulta.estado]))
  const saidas: SaidasSimples = {
    validos: coleta.numeros.filter(numero => estados.get(numero) === 'encontrado'),
    invalidos: coleta.numeros.filter(numero => estados.get(numero) === 'nao_encontrado'),
    exportacao: [], pendencias: [...coleta.pendencias], compartilhados: [], duplicadas: [],
  }
  const compartilhados = new Map<string, number[]>()
  for (const grupo of agruparIdentidades(coleta.linhas.map(prepararCadastro))) {
    // Pendência de cadastro não apaga o vínculo entre telefone e identidade.
    // Cada componente contribui uma única linha representante por número.
    if (grupo.some(cadastro => cadastro.identidades.length > 0)) {
      const representantes = new Map<string, number>()
      for (const { origem } of grupo) {
        if (origem.numero !== null && !representantes.has(origem.numero)) representantes.set(origem.numero, origem.linha)
      }
      for (const [numero, linha] of representantes) {
        const linhas = compartilhados.get(numero) ?? []
        linhas.push(linha)
        compartilhados.set(numero, linhas)
      }
    }
    const primeiro = grupo[0]
    const assinatura = JSON.stringify(primeiro.campos)
    const divergente = grupo.some(cadastro => JSON.stringify(cadastro.campos) !== assinatura || cadastro.motivo !== primeiro.motivo)
    if (divergente) {
      saidas.pendencias.push({
        linhas: grupo.map(cadastro => cadastro.origem.linha),
        numero: grupo.every(cadastro => cadastro.origem.numero === primeiro.origem.numero) ? primeiro.origem.numero : null,
        motivo: 'identidade_divergente',
      })
      continue
    }
    if (primeiro.motivo) {
      saidas.pendencias.push({ linhas: grupo.map(cadastro => cadastro.origem.linha), numero: primeiro.origem.numero, motivo: primeiro.motivo })
      continue
    }
    saidas.duplicadas.push(...grupo.slice(1).map(cadastro => cadastro.origem.linha))
    const numero = primeiro.origem.numero
    if (numero === null) continue

    if (estados.get(numero) === 'encontrado') saidas.exportacao.push(primeiro.campos)
  }
  saidas.compartilhados = [...compartilhados].flatMap(([numero, linhas]) => linhas.length > 1 ? [{ numero, linhas }] : [])
  saidas.duplicadas.sort((a, b) => a - b)
  saidas.pendencias.sort((a, b) => a.linhas[0] - b.linhas[0])
  return { ok: true, saidas }
}

export function serializarCsvCrm(exportacao: string[][]): string {
  const campo = (valor: string) => '"' + valor.replace(/"/g, '""') + '"'
  return [COLUNAS_CRM, ...exportacao]
    .map(linha => linha.map(campo).join(',')).join('\n') + '\n'
}
