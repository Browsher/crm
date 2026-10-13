export function nomeEmpresa(empresa: { razaoSocial: string | null; nomeFantasia: string | null }): string {
  return empresa.razaoSocial ?? empresa.nomeFantasia ?? 'Não informado'
}

export function formatarCnpj(cnpj: string | null): string {
  if (cnpj === null) return 'Não informado'
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return cnpj
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}
