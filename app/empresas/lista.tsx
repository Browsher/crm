import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody } from '@/src/components/ui/table'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import type { ConsultaEmpresas } from '@/src/features/empresas/consulta'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'
import { Linha } from './linha'
import styles from './empresas.module.css'

export function Lista({ linhas, consulta }: { linhas: EmpresaNaLista[]; consulta?: ConsultaEmpresas }) {
  if (linhas.length === 0) return <EstadoVazio titulo="Nenhuma empresa encontrada"
    descricao="Tente outro nome ou CNPJ, ou consulte a lista completa."
    acao={{ rotulo: 'Ver todas', href: '/empresas', variante: 'outline' }} />

  return <div role="region" aria-label="Empresas cadastradas" tabIndex={0} className={styles.rolagem}>
    <Table className={`${styles.tabela} crm-registros`}>
      <TableCaption className={styles.somenteLeitor}>Empresas cadastradas e seus dados de contato</TableCaption>
      <TableHeader><TableRow>{['Empresa', 'Localização', 'Contato', 'CNAE'].map(coluna => <TableHead key={coluna} scope="col">{coluna}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{linhas.map(empresa => <Linha key={empresa.id} empresa={empresa} consulta={consulta} />)}</TableBody>
    </Table>
  </div>
}
