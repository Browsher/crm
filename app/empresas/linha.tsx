import { formatarCnpj, formatarTelefone } from '@/src/features/empresas/formato'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'
import styles from './empresas.module.css'

export function Linha({ empresa }: { empresa: EmpresaNaLista }) {
  return <tr>
    <td>
      <strong>{empresa.razaoSocial}</strong>
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
