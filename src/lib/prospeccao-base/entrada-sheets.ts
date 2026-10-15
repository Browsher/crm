import type { LeituraSheets, LinhaScraping, PendenciaSimples } from './simples-modelo'
import { normalizarNumero } from './telefone'

export function lerColetaSheets(valores: unknown[][]): LeituraSheets {
  if (!Array.isArray(valores) || valores.length === 0 || !Array.from(valores).every(Array.isArray)) {
    return { ok: false, motivo: 'estrutura_invalida', detalhes: ['A entrada deve ser uma matriz com cabeçalho.'] }
  }

  const cabecalho = valores[0]
  const detalhes: string[] = []
  if (cabecalho[0] !== 'telefone') detalhes.push('A1 deve conter o cabeçalho exato telefone.')
  const nomes = new Set<string>()
  for (let coluna = 0; coluna < cabecalho.length; coluna++) {
    const nome = cabecalho[coluna]
    if (nome === null || nome === undefined || nome === '') continue
    if (typeof nome !== 'string' || !nome.trim() || nome !== nome.trim()) {
      detalhes.push(`Cabeçalho ilegível na coluna ${coluna + 1}.`)
      continue
    }
    if (nomes.has(nome)) detalhes.push(`Cabeçalho duplicado: ${nome}.`)
    nomes.add(nome)
  }

  let empresas = 0
  for (let indice = 1; indice < valores.length; indice++) {
    const linha = valores[indice]
    let preenchida = false
    for (let coluna = 0; coluna < linha.length; coluna++) {
      const valor = linha[coluna]
      if (valor === null || valor === undefined) continue
      if (typeof valor !== 'string' && typeof valor !== 'number' && typeof valor !== 'boolean'
        || typeof valor === 'number' && !Number.isFinite(valor)) {
        detalhes.push(`Célula ilegível na linha ${indice + 1}, coluna ${coluna + 1}.`)
        continue
      }
      if (!String(valor).trim()) continue
      preenchida = true
      if (!cabecalho[coluna]) {
        detalhes.push(`Valor sem cabeçalho na linha ${indice + 1}, coluna ${coluna + 1}.`)
      }
    }
    if (preenchida) empresas++
  }

  if (detalhes.length) return { ok: false, motivo: 'estrutura_invalida', detalhes }
  if (empresas > 5000) {
    return { ok: false, motivo: 'excede_limite', detalhes: [`A coleta contém ${empresas} empresas; o limite é 5.000.`] }
  }

  const linhas: LinhaScraping[] = []
  const numeros = new Set<string>()
  const pendencias: PendenciaSimples[] = []
  for (let indice = 1; indice < valores.length; indice++) {
    const linha = valores[indice]
    if (linha.every(valor => valor === null || valor === undefined || !String(valor).trim())) continue
    const dados: Record<string, string> = Object.fromEntries(
      cabecalho.flatMap((nome, coluna) => typeof nome === 'string' && nome
        ? [[nome, String(linha[coluna] ?? '')]]
        : []),
    )
    const resultado = normalizarNumero(dados.telefone)
    const numero = resultado.ok ? resultado.numero : null
    const registro: LinhaScraping = { linha: indice + 1, dados, numero }
    linhas.push(registro)
    if (resultado.ok) numeros.add(resultado.numero)
    else pendencias.push({ linhas: [registro.linha], numero: null, motivo: resultado.motivo })
  }
  return { ok: true, coleta: { linhas, numeros: [...numeros], pendencias } }
}
