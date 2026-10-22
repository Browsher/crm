import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody } from '@/src/components/ui/table'
import Link from 'next/link'
import type { ConsultaEmpresas } from '@/src/features/empresas/consulta'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'
import { Linha } from './linha'
import styles from './empresas.module.css'

export function Lista({ linhas, consulta }: { linhas: EmpresaNaLista[]; consulta?: ConsultaEmpresas }) {
  if (linhas.length === 0) return <div className={styles.vazio}>
    <h2>Nenhuma empresa encontrada</h2>
    <p>Tente outro nome ou CNPJ, ou consulte a lista completa.</p>
    <Link href="/empresas">Ver todas</Link>
  </div>

  return <div role="region" aria-label="Empresas cadastradas" tabIndex={0} className={styles.rolagem}>
    <Table className={`${styles.tabela} crm-registros`}>
      <TableCaption className={styles.somenteLeitor}>Empresas cadastradas e seus dados de contato</TableCaption>
      <TableHeader><TableRow>{['Empresa', 'Localização', 'Contato', 'CNAE'].map(coluna => <TableHead key={coluna} scope="col">{coluna}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{linhas.map(empresa => <Linha key={empresa.id} empresa={empresa} consulta={consulta} />)}</TableBody>
    </Table>
  </div>
}
