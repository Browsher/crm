// Pura: sem banco, sem rede. É a fase 1 da importação de empresas, que precisa
// recusar 'CEP: consultar' numa célula sem abrir conexão.
// Só remove separadores; qualquer letra sobrevive à limpeza e reprova no teste
// de oito dígitos, então 'a1310100' não vira '1310100'.
export function normalizarCep(bruto: string): string | null {
  const limpo = bruto.replace(/[\s.\-/]/g, '')
  return /^[0-9]{8}$/.test(limpo) ? limpo : null
}
