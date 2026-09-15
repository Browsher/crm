import { formatarCnpj, formatarTelefone } from '@/src/features/empresas/formato'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'
import styles from './empresas.module.css'

export function Linha({ empresa, consulta }: { empresa: EmpresaNaLista; consulta?: ConsultaEmpresas }) {
  const query = consulta ? enderecoEmpresas(consulta).split('?')[1] : undefined
  const href = `/empresas/${empresa.id}${query ? `?${query}` : ''}`
  return <tr>
    <td>
      <strong><Link href={href} className="underline underline-offset-4">{empresa.razaoSocial}</Link></strong>
      {empresa.nomeFantasia && <span className={styles.secundario}>{empresa.nomeFantasia}</span>}
      <span className={styles.documento}>{formatarCnpj(empresa.cnpj)}</span>
    </td>
    <td>{empresa.localidade ? <span>{empresa.localidade}/{empresa.uf}</span> : empresa.cep ? <>
      <span>CEP {empresa.cep}</span><span className={styles.secundario}>não encontrado na base</span>
    </> : <span className={styles.secundario}>sem CEP</span>}</td>
    <td><span>{formatarTelefone(empresa.telefone)}</span><span className={styles.secundario}>{empresa.email ?? 'E-mail não informado'}</span></td>
    <td><span>CNAE: {empresa.cnaePrincipal ?? 'Não informado'}</span></td>
  </tr>
}
import Link from 'next/link'
import { enderecoEmpresas, type ConsultaEmpresas } from '@/src/features/empresas/consulta'
