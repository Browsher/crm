// Guardado só em dígitos. Guardar '(11) 98765-4321' faria a mesma linha
// digitada com espaçamento diferente virar dois telefones.
//
// O DDD guardado aqui NÃO decide estado nenhum: medido no crm-ch, numa base de
// 2.246 empresas o DDD errou o estado em 845 delas, 38%. O telefone é
// habilitado onde o sócio mora, não onde a loja funciona. O estado vem do CEP.
export function normalizarTelefone(bruto: string): string | null {
  // Só separadores; letra sobrevive e reprova no teste de dígitos, então
  // 'ligar 11987654321' não vira um telefone.
  const limpo = bruto.replace(/[\s().-]/g, '')
  return /^[0-9]{10,11}$/.test(limpo) ? limpo : null
}
