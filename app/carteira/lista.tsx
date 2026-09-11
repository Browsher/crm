import Link from 'next/link'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import { filtrarCarteira, urlFicha, type FiltrosCarteira } from './filtros'
import styles from './carteira.module.css'

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
  if (!nota) return 'Conversa registrada sem anotação'
  return nota.length <= 180 ? nota : `${nota.slice(0, 179).trimEnd()}…`
}

function localizacao(empresa: EmpresaComigo): string {
  if (empresa.endereco) return `${empresa.endereco.localidade}, ${empresa.endereco.uf}`
  if (empresa.cep) return `CEP ${empresa.cep}. Localização não encontrada na base de CEP`
  return 'Localização não informada'
}

export function ListaCarteira({ linhas, filtros = SEM_FILTROS }: { linhas: EmpresaComigo[]; filtros?: FiltrosCarteira }) {
  if (linhas.length === 0) {
    return <div className={styles.vazio}>
      <h2>Sua carteira está vazia</h2>
      <p>Assuma uma empresa da fila para começar.</p>
      <Link href="/fila">Puxar a próxima empresa</Link>
    </div>
  }

  const filtradas = filtrarCarteira(linhas, filtros)
  const semPasso = filtradas.filter(linha => linha.situacaoRetorno === 'sem_data').length
  return <section aria-labelledby="titulo-clientes" className={styles.resultados}>
    <div className={styles.cabecalhoResultados}>
      <h2 id="titulo-clientes">Clientes</h2>
      <p className={styles.contagem}>{filtradas.length} de {linhas.length} {linhas.length === 1 ? 'empresa' : 'empresas'}</p>
    </div>
    {filtradas.length === 0 ? <div className={styles.vazio}>
      <h3>Nenhum cliente corresponde aos filtros</h3>
      <p>Altere os campos ou limpe os filtros para ver sua carteira.</p>
      <Link href="/carteira">Limpar filtros</Link>
    </div> : <>
      {semPasso > 0 ? <p className={styles.aviso}>
        {semPasso} {semPasso === 1 ? 'cliente sem próximo passo' : 'clientes sem próximo passo'}.
      </p> : null}
      <ul className={styles.grade}>
        {filtradas.map(empresa => <li key={empresa.id}>
          <article className={styles.card}>
            <header className={styles.cardCabecalho}>
              <div>
                <h3>{empresa.razaoSocial}</h3>
                {empresa.nomeFantasia ? <p>{empresa.nomeFantasia}</p> : null}
              </div>
              <span className={styles.estado}>{ROTULO_RETORNO[empresa.situacaoRetorno]}</span>
            </header>
            <dl className={styles.dados}>
              <div><dt>Contato principal</dt><dd>{empresa.contatoNome ?? 'Contato principal não informado'}</dd></div>
              <div><dt>Localização</dt><dd>{localizacao(empresa)}</dd></div>
            </dl>
            <section className={styles.bloco} aria-label="Última conversa">
              <h4>Última conversa</h4>
              {empresa.ultimoContato ? <>
                <p>{resumo(empresa.ultimoContato.nota)}</p>
                <time dateTime={empresa.ultimoContato.criadoEm.toISOString()}>{dataHora(empresa.ultimoContato.criadoEm)}</time>
              </> : <p>Ainda não há uma conversa registrada</p>}
            </section>
            <section className={styles.bloco} aria-label="Próximo passo">
              <h4>Próximo passo</h4>
              <p>{empresa.proximoPasso ?? 'Sem próximo passo combinado'}</p>
              {empresa.proximoPassoData ? <time dateTime={empresa.proximoPassoData}>{dataCivil(empresa.proximoPassoData)}</time> : null}
            </section>
            <footer className={styles.cardRodape}><Link href={urlFicha(empresa.id, filtros)}>Ver cliente</Link></footer>
          </article>
        </li>)}
      </ul>
    </>}
  </section>
}
