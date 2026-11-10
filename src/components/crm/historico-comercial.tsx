'use client'

import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Banknote, FileText, Phone } from 'lucide-react'
import { filtrarEventosHistorico, type EventoHistoricoComercial, type FiltroHistoricoComercial } from '@/src/lib/historico-comercial'
import { Button } from '@/src/components/ui/button'
import { ResumoVenda } from './resumo-venda'
import styles from './historico-comercial.module.css'

type Props = {
  eventos: readonly EventoHistoricoComercial[]
  rotulo?: string
  // Opt-in para listas multiempresa com nome autorizado. Outros adaptadores
  // usam evento.empresa apenas como identidade e podem fornecer um UUID.
  mostrarEmpresa?: boolean
  controleFiltro?: { valor: FiltroHistoricoComercial; aoMudar: (valor: FiltroHistoricoComercial) => void }
  controleExpansao?: { valor: Set<string>; aoMudar: Dispatch<SetStateAction<Set<string>>> }
  conteudoVazio?: ReactNode
}
const filtros: { valor: FiltroHistoricoComercial; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'atendimentos', rotulo: 'Atendimentos' },
  { valor: 'vendas', rotulo: 'Vendas' },
]
const dataRegistro = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' })
const horaRegistro = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'short' })

function identidade(evento: EventoHistoricoComercial) {
  return JSON.stringify([evento.empresa, evento.id])
}

export function HistoricoComercial({ eventos, rotulo = 'Histórico comercial', ...props }: Props) {
  // A identidade reinicia também em A → B → A, sem reutilizar a expansão anterior.
  const chave = JSON.stringify([rotulo, eventos.map(evento => [evento.empresa, evento.id])])
  return <ListaHistorico key={chave} eventos={eventos} rotulo={rotulo} {...props} />
}

function ListaHistorico({ eventos, rotulo, mostrarEmpresa, controleFiltro, controleExpansao, conteudoVazio }: Props) {
  const [filtroInterno, setFiltro] = useState<FiltroHistoricoComercial>('todos')
  const filtro = controleFiltro?.valor ?? filtroInterno
  const [expandidosInternos, setExpandidosInternos] = useState(() => new Set<string>())
  const expandidos = controleExpansao?.valor ?? expandidosInternos
  const setExpandidos = controleExpansao?.aoMudar ?? setExpandidosInternos
  const visiveis = filtrarEventosHistorico(eventos, filtro)
  const todosExpandidos = visiveis.length > 0 && visiveis.every(evento => expandidos.has(identidade(evento)))

  function definirExpansao(chave: string, aberto: boolean) {
    setExpandidos(atuais => {
      if (atuais.has(chave) === aberto) return atuais
      const proximos = new Set(atuais)
      if (aberto) proximos.add(chave)
      else proximos.delete(chave)
      return proximos
    })
  }

  function alternarTodos() {
    setExpandidos(atuais => {
      const proximos = new Set(atuais)
      for (const evento of visiveis) {
        if (todosExpandidos) proximos.delete(identidade(evento))
        else proximos.add(identidade(evento))
      }
      return proximos
    })
  }

  return <section className={styles.historico} aria-label={rotulo}>
    <div className={styles.controles}>
      <div className={styles.filtros} role="group" aria-label="Filtrar eventos">
        {filtros.map(opcao => <Button key={opcao.valor} type="button" size="sm"
          variant={filtro === opcao.valor ? 'secondary' : 'ghost'} aria-pressed={filtro === opcao.valor}
          onClick={() => controleFiltro ? controleFiltro.aoMudar(opcao.valor) : setFiltro(opcao.valor)}>
          {opcao.rotulo} <span className={styles.contagem}>{filtrarEventosHistorico(eventos, opcao.valor).length}</span>
        </Button>)}
      </div>
      <div className={styles.opcoes}>
        <span>Horários de Brasília</span>
        <Button type="button" size="sm" variant="ghost" disabled={visiveis.length === 0} onClick={alternarTodos}>
          {todosExpandidos ? 'Recolher todos' : 'Expandir todos'}
        </Button>
      </div>
    </div>
    {visiveis.length === 0 ? conteudoVazio ?? <p className={styles.vazio}>Nenhum registro neste filtro.</p> : <ol className={styles.lista}>
      {visiveis.map(evento => {
        const chave = identidade(evento)
        const instante = new Date(evento.criadoEm)
        const Icone = evento.natureza === 'venda' ? Banknote : evento.natureza === 'atividade_sem_ligacao' ? FileText : Phone
        const tipo = evento.natureza === 'venda' ? 'Venda' : evento.natureza === 'atividade_sem_ligacao' ? 'Atividade' : 'Atendimento'
        return <li key={chave} className={styles.registro}>
          <span className={evento.natureza === 'venda' ? styles.iconeVenda : styles.icone}><Icone size={14} aria-hidden="true" /></span>
          <details className={styles.evento} open={expandidos.has(chave)} onToggle={e => definirExpansao(chave, e.currentTarget.open)}>
            <summary className={styles.cabecalho} onKeyDown={e => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              definirExpansao(chave, !expandidos.has(chave))
            }}>
              {mostrarEmpresa && evento.empresa ? <span className={styles.empresa}>{evento.empresa}</span> : null}
              <span className={styles.titulo}><strong>{evento.titulo}</strong><span className={evento.natureza === 'venda' ? styles.tipoVenda : styles.tipo}>{tipo}</span></span>
              <span className={styles.metadados}>
                <time dateTime={evento.criadoEm}>{dataRegistro.format(instante)}, {horaRegistro.format(instante)}</time>
                <span>{evento.autor === null ? 'Autor não informado' : `Por ${evento.autor}`}</span>
              </span>
            </summary>
            <div className={styles.detalhes}>
              {evento.venda ? <ResumoVenda venda={evento.venda} /> : null}
              <p className={evento.nota ? styles.nota : styles.semNota}>{evento.nota ?? 'Sem anotação.'}</p>
              {evento.resultado || evento.proximoPasso ? <dl className={styles.informacoes}>
                {evento.resultado ? <div><dt>Resultado do atendimento</dt><dd>{evento.resultado}</dd></div> : null}
                {evento.proximoPasso ? <>
                  <div><dt>Próximo passo registrado</dt><dd>{evento.proximoPasso.descricao}</dd></div>
                  <div><dt>Data do retorno registrado</dt><dd>{evento.proximoPasso.data
                    ? <time dateTime={evento.proximoPasso.data}>{evento.proximoPasso.data.split('-').reverse().join('/')}</time>
                    : 'Data não informada'}</dd></div>
                </> : null}
              </dl> : null}
            </div>
          </details>
        </li>
      })}
    </ol>}
    <p className={styles.rodape}>{visiveis.length} {visiveis.length === 1 ? 'registro' : 'registros'} · Abra um evento para ver os detalhes.</p>
  </section>
}
