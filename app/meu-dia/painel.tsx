'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Contato } from '@/src/features/contato/historico'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import { Button } from '@/src/components/ui/button'
import { urlFichaDoMeuDia, urlMeuDia, type FiltrosMeuDia } from './agenda'
import { historicoDaAgendaAcao } from './historico-acao'
import styles from './meu-dia.module.css'

// Mesmo estreitamento do type predicate de `agendaDoDia`
// (`app/meu-dia/agenda.ts`), repetido aqui porque a assinatura exportada de
// `agendaDoDia`/`filtrarAgenda` devolve `EmpresaComigo[]`, então o
// estreitamento não atravessa a fronteira do módulo sem isto. A página
// (`app/meu-dia/page.tsx`) reaplica o mesmo predicate antes de passar a prop.
export type LinhaMeuDia = EmpresaComigo & { situacaoRetorno: 'atrasado' | 'hoje' }

const ROTULO_RETORNO: Record<'atrasado' | 'hoje', string> = { atrasado: 'Atrasado', hoje: 'Hoje' }

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

// `historicoAtual` (abaixo) só usa `historico` quando o `empresaId` bate com
// a seleção corrente. Isso cobre troca para OUTRA empresa, mas sozinho não
// cobre ida e volta: reselecionar a MESMA empresa (A -> B -> A) dispara um
// pedido novo com o MESMO empresaId de um `historico` que já existe em
// estado (de uma resposta anterior), e só comparar id deixaria esse dado
// velho vazar de volta para a tela enquanto o pedido novo está no ar. Por
// isso o clique que muda a seleção (não o efeito: `setState` síncrono no
// corpo de um efeito é código que o projeto proíbe, por bom motivo — ver
// `react-hooks/set-state-in-effect`) também zera `historico` na hora: a tela
// cai em "Carregando histórico" no mesmo render do clique, sem esperar o
// efeito rodar. Quem decide se o novo pedido "ganha" o direito de preencher
// `historico` de novo é o guarda de identidade (`pedido.current`) dentro do
// `.then`/`.catch`.
type EstadoHistorico =
  | { fase: 'pronto'; empresaId: string; contatos: Contato[] }
  | { fase: 'erro'; empresaId: string; motivo: 'falha' }

function Historico({ contatos }: { contatos: Contato[] }) {
  if (!contatos.length) return <p>Ainda não há uma conversa registrada</p>
  return <ol className={styles.historico}>{contatos.map(c => <li key={c.id}>
    <p>{resumo(c.nota)}</p>
    <time dateTime={c.criadoEm.toISOString()}>{dataHora(c.criadoEm)}</time>
  </li>)}</ol>
}

export function PainelMeuDia({ linhas, totalAgenda, filtros }: { linhas: LinhaMeuDia[]; totalAgenda: number; filtros: FiltrosMeuDia }) {
  const [selecionada, setSelecionada] = useState<string | null>(null)
  // Ids que a própria tela já sabe que saíram da carteira (posse negada),
  // sem esperar a próxima revalidação do servidor. `linhas` continua sendo a
  // prop do servidor; `linhasEfetivas` é o que a tela realmente mostra.
  const [removidos, setRemovidos] = useState<ReadonlySet<string>>(() => new Set())
  const [avisoPosse, setAvisoPosse] = useState(false)
  const linhasEfetivas = linhas.filter(l => !removidos.has(l.id))
  const totalEfetivo = totalAgenda - removidos.size

  // `selecionada === null` é "nada escolhido ainda": cai na primeira da
  // lista, como sempre. Uma vez que existe uma escolha explícita (mesmo que
  // essa empresa tenha acabado de sumir da lista por posse negada), não há
  // fallback para outra: escolher sozinho disparia um pedido de histórico
  // que o usuário não pediu.
  const atual = selecionada === null ? linhasEfetivas[0] : linhasEfetivas.find(l => l.id === selecionada)
  const atualId = atual?.id
  const [historico, setHistorico] = useState<EstadoHistorico | null>(null)
  const pedido = useRef<object | null>(null)

  useEffect(() => {
    if (!atualId) { pedido.current = null; return }
    const meu = {}
    pedido.current = meu
    void historicoDaAgendaAcao(atualId)
      .then(r => {
        if (pedido.current !== meu) return
        if (!r.ok && r.motivo === 'fora_da_carteira') {
          // A posse mudou: a empresa sai da lista e do perfil, sem escolher
          // outra sozinho. Trava a seleção no id que acabou de sumir (mesmo
          // que tenha chegado aqui pelo fallback implícito de `linhas[0]`),
          // para que `atual` vire `undefined` depois da remoção e nenhum
          // outro item vire seleção automática.
          setSelecionada(atualId)
          setRemovidos(prev => { const novo = new Set(prev); novo.add(atualId); return novo })
          setAvisoPosse(true)
          return
        }
        setHistorico(r.ok
          ? { fase: 'pronto', empresaId: atualId, contatos: r.contatos }
          : { fase: 'erro', empresaId: atualId, motivo: 'falha' })
      })
      .catch(() => {
        if (pedido.current !== meu) return
        setHistorico({ fase: 'erro', empresaId: atualId, motivo: 'falha' })
      })
  }, [atualId])

  if (linhasEfetivas.length === 0) {
    const semFiltro = filtros.nome === '' && filtros.retorno === ''
    return semFiltro
      ? <div className={styles.vazio}>
          <h2>Nenhum retorno pendente para hoje</h2>
          <p>Sua carteira não tem clientes atrasados ou com retorno hoje.</p>
          <Link href="/carteira">Ver carteira completa</Link>
        </div>
      : <div className={styles.vazio}>
          <h2>Nenhum cliente corresponde à busca</h2>
          <p>Altere os campos ou limpe os filtros para ver a agenda de hoje.</p>
          <Link href="/meu-dia">Limpar filtros</Link>
        </div>
  }

  const historicoAtual = historico && atual && historico.empresaId === atual.id ? historico : null

  return <>
    <p className={styles.contagem}>{linhasEfetivas.length} de {totalEfetivo} {totalEfetivo === 1 ? 'retorno' : 'retornos'}</p>
    <div className={styles.corpo}>
      <ul className={styles.colunaLista} data-testid="lista-meu-dia">
        {linhasEfetivas.map(empresa => {
          const ehSelecionada = empresa.id === atual?.id
          return <li key={empresa.id}>
            <button type="button" className={styles.item} aria-current={ehSelecionada ? 'true' : undefined}
              onClick={() => {
                setSelecionada(empresa.id)
                setAvisoPosse(false)
                // Zera aqui, no clique (não no efeito, que só reage depois do
                // commit): revisitar a MESMA empresa (ida e volta) não pode
                // reexibir um `historico` velho enquanto o novo pedido está no
                // ar. `historicoAtual` já filtra por id para empresas
                // diferentes; isto cobre o caso em que o id bate de novo.
                setHistorico(null)
              }}>
              <strong>{empresa.razaoSocial}</strong>
              <span className={styles.itemEstado}>{ROTULO_RETORNO[empresa.situacaoRetorno]}</span>
              <span>{empresa.proximoPasso ?? 'Sem próximo passo combinado'}</span>
              {empresa.proximoPassoData ? <time dateTime={empresa.proximoPassoData}>{dataCivil(empresa.proximoPassoData)}</time> : null}
            </button>
          </li>
        })}
      </ul>
      {avisoPosse ? <div className={styles.colunaPerfil}>
        <div role="alert" className={styles.perfil}>
          <h2>Esta empresa não está mais na sua carteira</h2>
          <p>A posse mudou desde que a agenda foi carregada.</p>
          <Link href={urlMeuDia(filtros)}>Recarregar a agenda</Link>
        </div>
      </div> : atual ? <div className={styles.colunaPerfil}>
        <article className={styles.perfil}>
          <header>
            <h2>{atual.razaoSocial}</h2>
            {atual.nomeFantasia ? <p>{atual.nomeFantasia}</p> : null}
          </header>
          <dl className={styles.dados}>
            <div><dt>Contato principal</dt><dd>{atual.contatoNome ?? 'Contato principal não informado'}</dd></div>
            <div><dt>Telefone</dt><dd>{atual.telefone || 'Telefone não cadastrado'}</dd></div>
            <div><dt>E-mail</dt><dd>{atual.email ?? 'E-mail não cadastrado'}</dd></div>
            <div><dt>Localização</dt><dd>{localizacao(atual)}</dd></div>
          </dl>
          <section className={styles.bloco} aria-label="Próximo passo">
            <h3>Próximo passo</h3>
            <p>{atual.proximoPasso ?? 'Sem próximo passo combinado'}</p>
            {atual.proximoPassoData ? <time dateTime={atual.proximoPassoData}>{dataCivil(atual.proximoPassoData)}</time> : null}
          </section>
          <section className={styles.bloco} aria-label="Histórico">
            <h3>Histórico</h3>
            {!historicoAtual ? <p>Carregando histórico</p>
              : historicoAtual.fase === 'pronto' ? <Historico contatos={historicoAtual.contatos} />
              : <p role="alert">Não foi possível carregar o histórico.</p>}
          </section>
          <Button asChild><Link href={urlFichaDoMeuDia(atual.id, filtros)}>Abrir atendimento</Link></Button>
        </article>
      </div> : null}
    </div>
  </>
}
