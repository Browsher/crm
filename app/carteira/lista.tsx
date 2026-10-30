import { Cartao } from '../fila/cartao'
import { Search, Wallet } from 'lucide-react'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { nomeEmpresa } from '@/src/lib/empresa-apresentacao'
import Link from 'next/link'
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'
import { filtrarCarteira, urlFicha, type FiltrosCarteira } from './filtros'
import styles from './carteira.module.css'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell, TableCaption } from '@/src/components/ui/table'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'

const SEM_FILTROS: FiltrosCarteira = { nome: '', uf: '', retorno: '' }
const ROTULO_RETORNO: Record<EmpresaComigo['situacaoRetorno'], string> = {
  atrasado: 'Atrasado', hoje: 'Hoje', futuro: 'Próximo', sem_data: 'Sem agendamento',
}

function dataCivil(valor: string): string {
  const [ano, mes, dia] = valor.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor
}

function dataHora(valor: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(valor)
}

function resumo(nota: string | null): string {
  if (!nota) return 'Atividade registrada sem anotação'
  return nota.length <= 180 ? nota : `${nota.slice(0, 179).trimEnd()}…`
}

function localizacao(empresa: EmpresaComigo): string {
  if (empresa.endereco) return `${empresa.endereco.localidade}, ${empresa.endereco.uf}`
  if (empresa.cep) return `CEP ${empresa.cep}. Localização não encontrada na base de CEP`
  return 'Localização não informada'
}

export function ListaCarteira({ linhas, filtros = SEM_FILTROS }: { linhas: EmpresaComigo[]; filtros?: FiltrosCarteira }) {
  if (linhas.length === 0) {
    return <EstadoVazio titulo="Sua carteira está vazia"
      descricao="Registre a primeira venda para incluir um cliente na carteira."
      icone={Wallet} acao={{ rotulo: 'Ir para Prospecção', href: '/fila' }} />
  }

  const filtradas = filtrarCarteira(linhas, filtros)
  const semPasso = filtradas.filter(linha => linha.situacaoRetorno === 'sem_data').length
  return <section aria-labelledby="titulo-clientes" className={styles.resultados}>
    <div className={styles.cabecalhoResultados}>
      <h2 id="titulo-clientes">Clientes</h2>
      <p className={styles.contagem}>{filtradas.length} de {linhas.length} {linhas.length === 1 ? 'empresa' : 'empresas'}</p>
    </div>
    {filtradas.length === 0 ? <EstadoVazio titulo="Nenhum cliente corresponde aos filtros"
      descricao="Altere os campos ou limpe os filtros para ver sua carteira."
      nivelTitulo={3} icone={Search} acao={{ rotulo: 'Limpar filtros', href: '/carteira', variante: 'outline' }} /> : <>
      {semPasso > 0 ? <p className={styles.aviso}>
        {semPasso} {semPasso === 1 ? 'cliente sem próximo passo' : 'clientes sem próximo passo'}.
      </p> : null}
      <Table className={`crm-registros ${styles.tabela}`}>
        <TableCaption className="sr-only">Clientes da sua carteira</TableCaption>
        <TableHeader><TableRow>{['Empresa', 'Contato principal', 'Última atividade', 'Próximo passo', 'Retorno', 'Ações'].map(titulo => <TableHead key={titulo} scope="col">{titulo}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{filtradas.map(empresa => <TableRow key={empresa.id}>
            <TableCell data-label="Empresa">{empresa.empresa ? <Cartao empresa={empresa.empresa} hrefCarteira={urlFicha(empresa.id, filtros)} /> : <h3>{nomeEmpresa(empresa)}</h3>}{empresa.razaoSocial && empresa.nomeFantasia ? <p>{empresa.nomeFantasia}</p> : null}<p>{localizacao(empresa)}</p></TableCell>
            <TableCell data-label="Contato principal">{empresa.contatoNome ?? 'Contato principal não informado'}</TableCell>
            <TableCell data-label="Última atividade">
              {empresa.ultimoContato ? <>
                <p>{resumo(empresa.ultimoContato.nota)}</p>
                <time dateTime={empresa.ultimoContato.criadoEm.toISOString()}>{dataHora(empresa.ultimoContato.criadoEm)}</time>
              </> : <p>Ainda não há uma atividade registrada</p>}
            </TableCell>
            <TableCell data-label="Próximo passo">
              <p>{empresa.proximoPasso ?? 'Sem próximo passo combinado'}</p>
              {empresa.proximoPassoData ? <time dateTime={empresa.proximoPassoData}>{dataCivil(empresa.proximoPassoData)}</time> : null}
            </TableCell>
            <TableCell data-label="Retorno"><Badge variant={empresa.situacaoRetorno === 'atrasado' ? 'warning' : empresa.situacaoRetorno === 'hoje' ? 'success' : 'outline'}>{ROTULO_RETORNO[empresa.situacaoRetorno]}</Badge></TableCell>
            <TableCell data-label="Ações"><Button asChild variant="outline" size="sm"><Link href={urlFicha(empresa.id, filtros)}>Ver cliente</Link></Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </>}
  </section>
}
