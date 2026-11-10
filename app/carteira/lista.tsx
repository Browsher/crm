import { Search, Wallet } from 'lucide-react'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { nomeEmpresa } from '@/src/lib/empresa-apresentacao'
import { MOTIVOS_INDISPONIBILIDADE, rotuloSituacao } from '@/src/lib/empresa-visual'
import Link from 'next/link'
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'
import { filtrarCarteira, localizacaoCarteira, urlFicha, type FiltrosCarteira } from './filtros'
import styles from './carteira.module.css'
import { Card, CardContent, CardFooter, CardHeader } from '@/src/components/ui/card'
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
  const { cidade, uf } = localizacaoCarteira(empresa)
  const lugar = [cidade, uf].filter(Boolean).join(', ')
  if (lugar) return lugar
  if (empresa.cep) return `CEP ${empresa.cep}. Localização não encontrada na base de CEP`
  return 'Localização não informada'
}

function CardCliente({ empresa, filtros }: { empresa: EmpresaComigo; filtros: FiltrosCarteira }) {
  const titulo = `carteira-cliente-${empresa.id}`
  const nome = nomeEmpresa(empresa)
  const fantasia = empresa.nomeFantasia && empresa.nomeFantasia !== nome ? empresa.nomeFantasia : null
  const retorno = empresa.situacaoRetorno
  const situacao = empresa.situacao
  const motivo = empresa.empresa?.motivoIndisponibilidade
  const estadoEspecial = situacao === 'sem_interesse' || situacao === 'arquivada' || situacao === 'indisponivel'
  return <Card role="article" aria-labelledby={titulo} className={styles.cliente}>
    <CardHeader className={styles.clienteCabecalho}>
      <div>
        <h3 id={titulo}>{nome}</h3>
        {fantasia && <p className={styles.metadado}>{fantasia}</p>}
        <p className={styles.metadado}>{localizacao(empresa)}</p>
        {motivo && <p className={styles.metadado}>{MOTIVOS_INDISPONIBILIDADE[motivo]}</p>}
      </div>
      <div className={styles.situacoes}>
        <Badge variant={retorno === 'atrasado' ? 'warning' : retorno === 'hoje' ? 'success' : 'outline'}>{ROTULO_RETORNO[retorno]}</Badge>
        {estadoEspecial && <Badge variant="outline">{rotuloSituacao(situacao)}</Badge>}
      </div>
    </CardHeader>
    <CardContent>
      <dl className={styles.clienteDetalhes}>
        <div>
          <dt>Última atividade</dt>
          <dd>{empresa.ultimoContato ? <>
            <p>{resumo(empresa.ultimoContato.nota)}</p>
            <time className={styles.metadado} dateTime={empresa.ultimoContato.criadoEm.toISOString()}>{dataHora(empresa.ultimoContato.criadoEm)}</time>
          </> : 'Ainda não há uma atividade registrada'}</dd>
        </div>
        <div>
          <dt>Próximo passo</dt>
          <dd>
            <p className={styles.proximoPasso}>{empresa.proximoPasso ?? 'Sem próximo passo combinado'}</p>
            {empresa.proximoPassoData && <p className={styles.metadado}>Retorno em <time dateTime={empresa.proximoPassoData}>{dataCivil(empresa.proximoPassoData)}</time></p>}
          </dd>
        </div>
      </dl>
    </CardContent>
    <CardFooter className={styles.clienteRodape}>
      <p className={styles.contato}>{empresa.contatoNome ? <>Contato principal <strong>{empresa.contatoNome}</strong></> : 'Contato principal não informado'}</p>
      <Button asChild variant="outline" size="sm"><Link href={urlFicha(empresa.id, filtros)} scroll={false} aria-describedby={titulo}>Ver cliente</Link></Button>
    </CardFooter>
  </Card>
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
      <div className={styles.clientes}>
        {filtradas.map(empresa => <CardCliente key={empresa.id} empresa={empresa} filtros={filtros} />)}
      </div>
    </>}
  </section>
}
