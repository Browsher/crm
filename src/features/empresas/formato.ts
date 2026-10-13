// O banco guarda normalizado (14 caracteres, só dígitos no telefone) porque a
// mesma empresa digitada com espaçamento diferente não pode virar duas.
// Formatar só na saída é o outro lado da mesma decisão: nada daqui volta para o
// banco.
export { formatarCnpj } from '../../lib/empresa-apresentacao'

export function formatarTelefone(telefone: string): string {
  if (/^[0-9]{11}$/.test(telefone)) {
    return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 7)}-${telefone.slice(7)}`
  }
  if (/^[0-9]{10}$/.test(telefone)) {
    return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 6)}-${telefone.slice(6)}`
  }
  return telefone
}
