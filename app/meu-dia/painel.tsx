'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Contato } from '@/src/features/contato/historico'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import { urlFichaDoMeuDia, urlMeuDia, type FiltrosMeuDia } from './agenda'
import { historicoDaAgendaAcao } from './historico-acao'
import styles from './meu-dia.module.css'

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

// Sem fase "carregando": enquanto não existe resposta para a seleção
// corrente, `historicoAtual` (abaixo) já é `null`, e é isso que a
// renderização usa para mostrar "Carregando histórico".
type EstadoHistorico =
  | { fase: 'pronto'; empresaId: string; contatos: Contato[] }
  | { fase: 'erro'; empresaId: string; motivo: 'fora_da_carteira' | 'falha' }

function Historico({ contatos }: { contatos: Contato[] }) {
  if (!contatos.length) return <p>Ainda não há uma conversa registrada</p>
  return <ol className={styles.historico}>{contatos.map(c => <li key={c.id}>
    <p>{resumo(c.nota)}</p>
    <time dateTime={c.criadoEm.toISOString()}>{dataHora(c.criadoEm)}</time>
  </li>)}</ol>
}

export function PainelMeuDia({ linhas, filtros }: { linhas: EmpresaComigo[]; filtros: FiltrosMeuDia }) {
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const atual = linhas.find(l => l.id === selecionada) ?? linhas[0]
  const atualId = atual?.id
  // `historico` só é lido quando `empresaId` bate com a seleção corrente (veja
  // `historicoAtual` abaixo). Enquanto a empresa muda, some ou o pedido ainda
  // está em voo, a renderização cai no "Carregando histórico" por conta
  // disso, sem precisar zerar o estado sincronamente dentro do efeito.
  const [historico, setHistorico] = useState<EstadoHistorico | null>(null)
  const pedido = useRef<object | null>(null)

  useEffect(() => {
    if (!atualId) { pedido.current = null; return }
    const meu = {}
    pedido.current = meu
    void historicoDaAgendaAcao(atualId)
      .then(r => {
        if (pedido.current !== meu) return
        setHistorico(r.ok
          ? { fase: 'pronto', empresaId: atualId, contatos: r.contatos }
          : { fase: 'erro', empresaId: atualId, motivo: r.motivo })
      })
      .catch(() => {
        if (pedido.current !== meu) return
        setHistorico({ fase: 'erro', empresaId: atualId, motivo: 'falha' })
      })
    return () => { if (pedido.current === meu) pedido.current = null }
  }, [atualId])

  if (linhas.length === 0) {
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
  const semPosse = historicoAtual?.fase === 'erro' && historicoAtual.motivo === 'fora_da_carteira'

  return <div className={styles.corpo}>
    <ul className={styles.colunaLista} data-testid="lista-meu-dia">
      {linhas.map(empresa => {
        const ehSelecionada = empresa.id === atual?.id
        const retorno = empresa.situacaoRetorno as 'atrasado' | 'hoje'
        return <li key={empresa.id}>
          <button type="button" className={styles.item} aria-current={ehSelecionada ? 'true' : undefined}
            onClick={() => setSelecionada(empresa.id)}>
            <strong>{empresa.razaoSocial}</strong>
            <span className={styles.itemEstado}>{ROTULO_RETORNO[retorno]}</span>
            <span>{empresa.proximoPasso ?? 'Sem próximo passo combinado'}</span>
            {empresa.proximoPassoData ? <time dateTime={empresa.proximoPassoData}>{dataCivil(empresa.proximoPassoData)}</time> : null}
          </button>
        </li>
      })}
    </ul>
    {atual ? <div className={styles.colunaPerfil}>
      {semPosse ? <div role="alert" className={styles.perfil}>
        <h2>Esta empresa não está mais na sua carteira</h2>
        <p>A posse mudou desde que a agenda foi carregada.</p>
        <Link href={urlMeuDia(filtros)}>Recarregar a agenda</Link>
      </div> : <article className={styles.perfil}>
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
        <Link href={urlFichaDoMeuDia(atual.id, filtros)}>Abrir atendimento</Link>
      </article>}
    </div> : null}
  </div>
}
