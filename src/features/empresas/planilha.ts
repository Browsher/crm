import { normalizarCep } from '../../server/cep/resolver'
import { normalizarCnpj, pareceNotacaoCientifica, validarCnpj } from './cnpj'
import { normalizarCnae } from './cnae'
import { lerCsv } from './csv'
import { normalizarTelefone } from './telefone'

export const CABECALHO_LEGADO = 'cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep'
export const CABECALHO = `${CABECALHO_LEGADO},cnae_principal`
export const CABECALHO_GOOGLE = `${CABECALHO},google_place_id`
export const LIMITE_DE_LINHAS = 5000

export type LinhaAceita = {
  linha: number
  cnpj: string | null
  razaoSocial: string | null
  googlePlaceId: string | null
  nomeFantasia: string | null
  contatoNome: string | null
  telefone: string
  email: string | null
  cep: string | null
  cnaePrincipal: string | null
}

export type MotivoDeCampo =
  | 'nome_ausente'
  | 'identidade_ausente'
  | 'google_place_id_invalido'
  | 'cnpj_vazio'
  | 'cnpj_notacao_cientifica'
  | 'cnpj_forma'
  | 'cnpj_dv'
  | 'razao_social_vazia'
  | 'telefone_vazio'
  | 'telefone_forma'
  | 'email_forma'
  | 'cep_curto'
  | 'cep_forma'
  | 'cnae_forma'
  | 'caractere_invalido'
  | 'colunas_erradas'

export type Recusa =
  | { tipo: 'campo'; linha: number; motivo: MotivoDeCampo; valor: string; esperado?: 7 | 8 | 9 }
  | { tipo: 'repetido'; linha: number; par: number; identificador: 'cnpj' | 'google_place_id'; valor: string; divergencia: string | null }
  | { tipo: 'identidade'; linha: number; motivo: 'identificadores_divergentes' | 'cnpj_divergente' | 'razao_social_divergente' | 'empresa_repetida' }

export type FalhaDeArquivo =
  | { motivo: 'nao_utf8' }
  | { motivo: 'vazio' }
  | { motivo: 'cabecalho_diferente'; encontrado: string }
  | { motivo: 'aspas_nao_fechadas'; linha: number }
  | { motivo: 'excede_limite'; linhas: number }
  | { motivo: 'formato_nao_suportado' }
  | { motivo: 'excede_tamanho' }
  | { motivo: 'xlsx_corrompido' }
  | { motivo: 'estrutura_nao_suportada' }
  | { motivo: 'planilhas_ambiguas' }
  | { motivo: 'formula_nao_permitida'; linha: number; coluna: string }

export type Analise = { ok: false; falha: FalhaDeArquivo } | { ok: true; aceitas: LinhaAceita[]; recusadas: Recusa[] }

const EMAIL = /^[^\s@]+@[^\s@]+$/

function decodificar(bytes: Uint8Array): string | null {
  try {
    // fatal: true é o ponto do exercício — Windows-1252 tem que doer aqui, e
    // não virar acento estragado que ninguém vê até a empresa estar cadastrada.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return null
  }
}

function vazio(v: string | undefined): boolean {
  return (v ?? '').trim() === ''
}

function ouNulo(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}

type Campo = { tipo: 'campo'; linha: number; motivo: MotivoDeCampo; valor: string; esperado?: 7 | 8 | 9 }
const recusa = (linha: number, motivo: MotivoDeCampo, valor: string): Campo => ({ tipo: 'campo', linha, motivo, valor })

// Uma linha do CSV vira LinhaAceita ou uma recusa. A ordem das checagens é
// deliberada: o diagnóstico do Excel vem antes da checagem de forma, senão
// '1,23457E+13' sairia como "CNPJ inválido" e o gestor não descobriria que a
// causa é a formatação da coluna.
function analisarLinha(campos: string[], linha: number, colunas: string[], esperado: 7 | 8 | 9): LinhaAceita | Campo {
  // O cabeçalho escolhe o formato; nenhum campo excedente pode ser descartado.
  if (campos.length !== esperado) return { ...recusa(linha, 'colunas_erradas', String(campos.length)), esperado }

  // Byte NUL e UTF-8 valido: passa pelo TextDecoder e so o Postgres recusa, com
  // 22021. Pego aqui, o gestor recebe a linha e a coluna; traduzido do banco,
  // receberia uma mensagem sem localizacao nenhuma.
  const sujo = colunas.findIndex((_, i) => colunas[i] !== 'google_place_id' && campos[i]?.includes('\u0000'))
  if (sujo !== -1) return recusa(linha, 'caractere_invalido', colunas[sujo])
  const [bCnpj, bRazao, bFantasia, bContato, bTelefone, bEmail, bCep, bCnae = '', bGoogle = ''] = campos

  let cnpj: string | null = null
  if (vazio(bCnpj)) {
    if (esperado !== 9) return recusa(linha, 'cnpj_vazio', bCnpj.trim())
  } else {
    if (pareceNotacaoCientifica(bCnpj)) return recusa(linha, 'cnpj_notacao_cientifica', bCnpj.trim())
    cnpj = normalizarCnpj(bCnpj)
    if (cnpj === null) return recusa(linha, 'cnpj_forma', bCnpj.trim())
    if (!validarCnpj(cnpj)) return recusa(linha, 'cnpj_dv', bCnpj.trim())
  }
  const googlePlaceId = ouNulo(bGoogle)
  // Medir pontos de código como length(text) no Postgres; UTF-16 conta emoji duas vezes.
  if ((googlePlaceId !== null && [...googlePlaceId].length > 255) || /[\u0000-\u001f\u007f-\u009f]/.test(bGoogle)) {
    return recusa(linha, 'google_place_id_invalido', googlePlaceId ?? '')
  }
  if (cnpj === null && googlePlaceId === null) return recusa(linha, 'identidade_ausente', '')
  const razaoSocial = ouNulo(bRazao)
  if (razaoSocial === null && ouNulo(bFantasia) === null) return recusa(linha, 'nome_ausente', '')

  if (vazio(bTelefone)) return recusa(linha, 'telefone_vazio', bTelefone.trim())
  const telefone = normalizarTelefone(bTelefone)
  if (telefone === null) return recusa(linha, 'telefone_forma', bTelefone.trim())

  const email = ouNulo(bEmail)?.toLowerCase() ?? null
  if (email !== null && !EMAIL.test(email)) return recusa(linha, 'email_forma', bEmail.trim())

  const brutoCep = ouNulo(bCep)
  let cep: string | null = null
  if (brutoCep !== null) {
    cep = normalizarCep(brutoCep)
    // Sete dígitos é a assinatura do zero à esquerda comido pelo Excel; sai com
    // motivo próprio para a mensagem poder explicar a causa.
    if (cep === null) return recusa(linha, /^[0-9]{7}$/.test(brutoCep) ? 'cep_curto' : 'cep_forma', brutoCep)
  }

  const cnae = normalizarCnae(bCnae)
  if (!cnae.ok) return recusa(linha, 'cnae_forma', bCnae.trim())

  return {
    linha,
    cnpj,
    razaoSocial,
    googlePlaceId,
    nomeFantasia: ouNulo(bFantasia),
    contatoNome: ouNulo(bContato),
    telefone,
    email,
    cep,
    cnaePrincipal: cnae.valor,
  }
}

// Campo aqui dentro → nome da COLUNA da planilha. O relatório fala a língua do
// arquivo, não a do código: quem lê procura pelo nome que digitou no cabeçalho,
// e "razaoSocial" num relatório sobre um arquivo cuja coluna se chama
// "razao_social" manda a pessoa procurar o que não existe.
//
// Os dois lados no mesmo par de propósito: separados, o dia que uma coluna for
// renomeada só um dos dois muda. O teste confere que todo nome daqui está no
// CABECALHO.
const COMPARAVEIS: readonly (readonly [keyof LinhaAceita, string])[] = [
  ['cnpj', 'cnpj'],
  ['googlePlaceId', 'google_place_id'],
  ['razaoSocial', 'razao_social'],
  ['nomeFantasia', 'nome_fantasia'],
  ['contatoNome', 'contato_nome'],
  ['telefone', 'telefone'],
  ['email', 'email'],
  ['cep', 'cep'],
  ['cnaePrincipal', 'cnae_principal'],
]

// Duplicata idêntica é copiar e colar sem querer, e dá para apagar uma sem
// pensar. Divergente exige alguém decidir qual está certa — sem o nome da
// coluna o gestor apaga a errada sem saber que estava escolhendo.
function divergenciaEntre(a: LinhaAceita, b: LinhaAceita): string | null {
  for (const [campo, coluna] of COMPARAVEIS) {
    if (a[campo] !== b[campo]) return coluna
  }
  return null
}

export type LinhaBruta = { campos: string[]; numero: number }

export function analisarLinhas(linhas: LinhaBruta[]): Analise {
  if (linhas.length === 0) return { ok: false, falha: { motivo: 'vazio' } }

  const cabecalho = linhas[0].campos.join(',')
  if (cabecalho !== CABECALHO_GOOGLE && cabecalho !== CABECALHO && cabecalho !== CABECALHO_LEGADO) return { ok: false, falha: { motivo: 'cabecalho_diferente', encontrado: cabecalho } }

  const colunas = cabecalho.split(',')
  const esperado = cabecalho === CABECALHO_GOOGLE ? 9 : cabecalho === CABECALHO ? 8 : 7

  const dados = linhas.slice(1)
  if (dados.length === 0) return { ok: false, falha: { motivo: 'vazio' } }
  if (dados.length > LIMITE_DE_LINHAS) return { ok: false, falha: { motivo: 'excede_limite', linhas: dados.length } }

  const aceitas: LinhaAceita[] = []
  const recusadas: Recusa[] = []
  for (const l of dados) {
    const r = analisarLinha(l.campos, l.numero, colunas, esperado)
    if ('tipo' in r) recusadas.push(r)
    else aceitas.push(r)
  }

  // Duplicata interna: as DUAS saem. Escolher uma seria chutar qual está certa,
  // e o chute ficaria gravado como identidade.
  const repetidas = new Map<number, Extract<Recusa, { tipo: 'repetido' }>>()
  for (const [campo, identificador] of [['cnpj', 'cnpj'], ['googlePlaceId', 'google_place_id']] as const) {
    const porIdentificador = new Map<string, LinhaAceita[]>()
    for (const l of aceitas) {
      const valor = l[campo]
      if (valor === null) continue
      const grupo = porIdentificador.get(valor)
      if (grupo) grupo.push(l)
      else porIdentificador.set(valor, [l])
    }
    for (const [valor, grupo] of porIdentificador) {
      if (grupo.length === 1) continue
      for (const [i, l] of grupo.entries()) {
        const outra = grupo[i === 0 ? 1 : i - 1]
        if (!repetidas.has(l.linha)) repetidas.set(l.linha, {
          tipo: 'repetido', linha: l.linha, par: outra.linha, identificador, valor,
          divergencia: divergenciaEntre(l, outra),
        })
      }
    }
  }
  const sobreviventes = aceitas.filter(l => !repetidas.has(l.linha))
  recusadas.push(...repetidas.values())

  recusadas.sort((a, b) => a.linha - b.linha)
  return { ok: true, aceitas: sobreviventes, recusadas }
}

export function analisarPlanilha(bytes: Uint8Array): Analise {
  const texto = decodificar(bytes)
  if (texto === null) return { ok: false, falha: { motivo: 'nao_utf8' } }

  const lido = lerCsv(texto)
  if (!lido.ok) return { ok: false, falha: { motivo: 'aspas_nao_fechadas', linha: lido.linha } }
  return analisarLinhas(lido.linhas)
}
