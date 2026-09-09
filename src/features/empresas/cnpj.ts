// Pura: sem banco, sem rede. É a fase 1 da importação, que recusa
// 'CNPJ: consultar' numa célula sem abrir conexão.
export function normalizarCnpj(bruto: string): string | null {
  const limpo = bruto.replace(/[\s./-]/g, '').toUpperCase()
  return /^[0-9A-Z]{12}[0-9]{2}$/.test(limpo) ? limpo : null
}

// O CNPJ alfanumérico está em vigor desde 2026-07-06 (IN RFB 2.229/2024). O
// cálculo trata cada caractere pelo código ASCII menos 48: '0'→0 … '9'→9,
// 'A'→17 … 'Z'→42. Para CNPJ numérico o resultado é idêntico ao cálculo antigo,
// então esta é a única implementação necessária — não existe versão antiga.
function digito(chars: string): number {
  let soma = 0
  let peso = 2
  for (let i = chars.length - 1; i >= 0; i--) {
    soma += (chars.charCodeAt(i) - 48) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function validarCnpj(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false
  // Sequência de um caractere só passa no cálculo e nunca é CNPJ real.
  if (/^(.)\1{13}$/.test(cnpj)) return false
  const base = cnpj.slice(0, 12)
  const d1 = digito(base)
  const d2 = digito(base + String(d1))
  return cnpj.slice(12) === `${d1}${d2}`
}

// Diagnóstico, não validação: o Excel transforma 14 dígitos em 1,23457E+13 e
// os dígitos se perdem de verdade. Sem esta mensagem o gestor vê "CNPJ
// inválido" e não descobre que a culpa é da formatação da coluna.
export function pareceNotacaoCientifica(bruto: string): boolean {
  return /^[0-9]+[,.]?[0-9]*E\+?[0-9]+$/i.test(bruto.trim())
}
