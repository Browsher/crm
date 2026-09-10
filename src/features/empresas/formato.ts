// O banco guarda normalizado (14 caracteres, só dígitos no telefone) porque a
// mesma empresa digitada com espaçamento diferente não pode virar duas.
// Formatar só na saída é o outro lado da mesma decisão: nada daqui volta para o
// banco.
export function formatarCnpj(cnpj: string): string {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return cnpj
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}

export function formatarTelefone(telefone: string): string {
  if (/^[0-9]{11}$/.test(telefone)) {
    return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 7)}-${telefone.slice(7)}`
  }
  if (/^[0-9]{10}$/.test(telefone)) {
    return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 6)}-${telefone.slice(6)}`
  }
  return telefone
}
