// Pura: sem banco, sem rede. Só remove separadores; letras continuam inválidas.
export function normalizarCep(bruto: string): string | null {
  const limpo = bruto.replace(/[\s.\-/]/g, '')
  return /^[0-9]{8}$/.test(limpo) ? limpo : null
}
