import { formatarCnpj, formatarTelefone } from '@/src/features/empresas/formato'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'

// Três estados, e não dois. "sem endereço" para os dois últimos juntos
// esconderia a diferença entre "ninguém preencheu o CEP" e "a base de
// julho/2024 não tem este CEP" — consertos diferentes, feitos por gente
// diferente. É a mesma separação que textoDoEndereco faz no relatório.
function endereco(empresa: EmpresaNaLista): string {
  if (empresa.localidade) return `${empresa.localidade}/${empresa.uf}`
  if (empresa.cep) return `CEP ${empresa.cep} — não encontrado na base`
  return 'sem CEP'
}

export function Linha({ empresa }: { empresa: EmpresaNaLista }) {
  return (
    <li className="flex flex-col gap-1 border-b py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{empresa.razaoSocial}</span>
        {empresa.nomeFantasia && <span className="text-sm text-neutral-600">{empresa.nomeFantasia}</span>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-600">
        <span className="font-mono">{formatarCnpj(empresa.cnpj)}</span>
        <span>{formatarTelefone(empresa.telefone)}</span>
        {empresa.email && <span>{empresa.email}</span>}
        <span>{endereco(empresa)}</span>
        <span>CNAE: {empresa.cnaePrincipal ?? 'Não informado'}</span>
      </div>
    </li>
  )
}
