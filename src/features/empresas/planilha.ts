import { normalizarCep } from '../../server/cep/resolver'
import { normalizarCnpj, pareceNotacaoCientifica, validarCnpj } from './cnpj'
import { lerCsv } from './csv'
import { normalizarTelefone } from './telefone'

export const CABECALHO = 'cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep'
export const LIMITE_DE_LINHAS = 5000

export type LinhaAceita = {
  linha: number
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  contatoNome: string | null
  telefone: string
  email: string | null
  cep: string | null
}

export type MotivoDeCampo =
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
  | 'colunas_de_menos'

export type Recusa =
  | { tipo: 'campo'; linha: number; motivo: MotivoDeCampo; valor: string }
  | { tipo: 'repetido'; linha: number; par: number; cnpj: string; divergencia: string | null }

export type FalhaDeArquivo =
  | { motivo: 'nao_utf8' }
  | { motivo: 'vazio' }
  | { motivo: 'cabecalho_diferente'; encontrado: string }
  | { motivo: 'aspas_nao_fechadas'; linha: number }
  | { motivo: 'excede_limite'; linhas: number }

export type Analise = { ok: false; falha: FalhaDeArquivo } | { ok: true; aceitas: LinhaAceita[]; recusadas: Recusa[] }

const COLUNAS = CABECALHO.split(',')
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

type Campo = { tipo: 'campo'; linha: number; motivo: MotivoDeCampo; valor: string }
const recusa = (linha: number, motivo: MotivoDeCampo, valor: string): Campo => ({ tipo: 'campo', linha, motivo, valor })

// Uma linha do CSV vira LinhaAceita ou uma recusa. A ordem das checagens é
// deliberada: o diagnóstico do Excel vem antes da checagem de forma, senão
// '1,23457E+13' sairia como "CNPJ inválido" e o gestor não descobriria que a
// causa é a formatação da coluna.
function analisarLinha(campos: string[], linha: number): LinhaAceita | Campo {
  if (campos.length < COLUNAS.length) return recusa(linha, 'colunas_de_menos', String(campos.length))
  const [bCnpj, bRazao, bFantasia, bContato, bTelefone, bEmail, bCep] = campos

  if (vazio(bCnpj)) return recusa(linha, 'cnpj_vazio', bCnpj.trim())
  if (pareceNotacaoCientifica(bCnpj)) return recusa(linha, 'cnpj_notacao_cientifica', bCnpj.trim())
  const cnpj = normalizarCnpj(bCnpj)
  if (cnpj === null) return recusa(linha, 'cnpj_forma', bCnpj.trim())
  if (!validarCnpj(cnpj)) return recusa(linha, 'cnpj_dv', bCnpj.trim())

  if (vazio(bRazao)) return recusa(linha, 'razao_social_vazia', bRazao)

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

  return {
    linha,
    cnpj,
    razaoSocial: bRazao.trim(),
    nomeFantasia: ouNulo(bFantasia),
    contatoNome: ouNulo(bContato),
    telefone,
    email,
    cep,
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
  ['razaoSocial', 'razao_social'],
  ['nomeFantasia', 'nome_fantasia'],
  ['contatoNome', 'contato_nome'],
  ['telefone', 'telefone'],
  ['email', 'email'],
  ['cep', 'cep'],
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

export function analisarPlanilha(bytes: Uint8Array): Analise {
  const texto = decodificar(bytes)
  if (texto === null) return { ok: false, falha: { motivo: 'nao_utf8' } }

  const lido = lerCsv(texto)
  if (!lido.ok) return { ok: false, falha: { motivo: 'aspas_nao_fechadas', linha: lido.linha } }
  if (lido.linhas.length === 0) return { ok: false, falha: { motivo: 'vazio' } }

  const cabecalho = lido.linhas[0].join(',')
  if (cabecalho !== CABECALHO) return { ok: false, falha: { motivo: 'cabecalho_diferente', encontrado: cabecalho } }

  const dados = lido.linhas.slice(1)
  if (dados.length === 0) return { ok: false, falha: { motivo: 'vazio' } }
  if (dados.length > LIMITE_DE_LINHAS) return { ok: false, falha: { motivo: 'excede_limite', linhas: dados.length } }

  const aceitas: LinhaAceita[] = []
  const recusadas: Recusa[] = []
  for (const [i, campos] of dados.entries()) {
    const r = analisarLinha(campos, i + 2)
    if ('tipo' in r) recusadas.push(r)
    else aceitas.push(r)
  }

  // Duplicata interna: as DUAS saem. Escolher uma seria chutar qual está certa,
  // e o chute ficaria gravado como identidade.
  const porCnpj = new Map<string, LinhaAceita[]>()
  for (const l of aceitas) {
    const grupo = porCnpj.get(l.cnpj)
    if (grupo) grupo.push(l)
    else porCnpj.set(l.cnpj, [l])
  }
  const sobreviventes: LinhaAceita[] = []
  for (const grupo of porCnpj.values()) {
    if (grupo.length === 1) {
      sobreviventes.push(grupo[0])
      continue
    }
    for (const [i, l] of grupo.entries()) {
      const outra = grupo[i === 0 ? 1 : i - 1]
      recusadas.push({
        tipo: 'repetido',
        linha: l.linha,
        par: outra.linha,
        cnpj: l.cnpj,
        divergencia: divergenciaEntre(l, outra),
      })
    }
  }

  recusadas.sort((a, b) => a.linha - b.linha)
  return { ok: true, aceitas: sobreviventes, recusadas }
}
