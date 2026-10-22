import { TableRow, TableCell } from '@/src/components/ui/table'
import { nomeEmpresa } from '@/src/lib/empresa-apresentacao'
import { formatarCnpj, formatarTelefone } from '@/src/features/empresas/formato'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'
import styles from './empresas.module.css'

export function Linha({ empresa, consulta }: { empresa: EmpresaNaLista; consulta?: ConsultaEmpresas }) {
  const query = consulta ? enderecoEmpresas(consulta).split('?')[1] : undefined
  const href = `/empresas/${empresa.id}${query ? `?${query}` : ''}`
  return <TableRow>
    <TableCell data-label="Empresa">
      <strong><Link href={href} className="underline underline-offset-4">{nomeEmpresa(empresa)}</Link></strong>
      {empresa.razaoSocial && empresa.nomeFantasia && <span className={styles.secundario}>{empresa.nomeFantasia}</span>}
      <span className={styles.documento}>{formatarCnpj(empresa.cnpj)}</span>
    </TableCell>
    <TableCell data-label="Localização">{empresa.localidade ? <span>{empresa.localidade}/{empresa.uf}</span> : empresa.cep ? <>
      <span>CEP {empresa.cep}</span><span className={styles.secundario}>não encontrado na base</span>
    </> : <span className={styles.secundario}>sem CEP</span>}</TableCell>
    <TableCell data-label="Contato"><span>{formatarTelefone(empresa.telefone)}</span><span className={styles.secundario}>{empresa.email ?? 'E-mail não informado'}</span></TableCell>
    <TableCell data-label="CNAE"><span>CNAE: {empresa.cnaePrincipal ?? 'Não informado'}</span></TableCell>
  </TableRow>
}
import Link from 'next/link'
import { enderecoEmpresas, type ConsultaEmpresas } from '@/src/features/empresas/consulta'
