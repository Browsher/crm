import { rotuloSituacao } from '@/src/lib/empresa-visual'
import { urlColetaGestor, type OrigemFichaGestor } from '@/src/lib/retorno-gestor'
import { DadosCadastrais } from '@/src/components/crm/dados-cadastrais'
import { LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import { formatarCnpj, formatarTelefone } from '@/src/features/empresas/formato'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Alert } from '@/src/components/ui/alert'
import styles from './perfil.module.css'
import { AbasFicha } from '@/src/components/crm/abas-ficha'
import { HistoricoGoogleEmpresa } from '@/src/components/crm/historico-google'
import { DadosSocios } from '../dados-socios'
import type { FichaEmpresa } from './ficha-leitura'
import type { ReactNode } from 'react'

const horario = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
function dataCivil(data: string) { return data.split('-').reverse().join('/') }

export function IdentificacaoFicha({ empresa, children }: { empresa: FichaEmpresa['empresa']; children?: ReactNode }) {
  const endereco = empresa.cidade ? [empresa.logradouro, empresa.bairro, `${empresa.cidade}/${empresa.uf}`].filter(Boolean).join(', ')
    : empresa.cep ? `CEP ${empresa.cep}. Endereço não encontrado na base de CEP.` : 'Localização não cadastrada'
  return <div className={styles.cabecalho}><div>{children}
    {empresa.razaoSocial && <p>{empresa.nomeFantasia ?? 'Nome fantasia não cadastrado'}</p>}<p>{endereco}</p></div>
    <Badge variant="outline">{rotuloSituacao(empresa.situacao)}</Badge></div>
}

export function ConteudoFicha({ ficha, abaInicial, origemHistorico, lateral = false }: {
  ficha: FichaEmpresa
  abaInicial: 'dados' | 'historico'
  origemHistorico?: OrigemFichaGestor
  lateral?: boolean
}) {
  const { empresa, historico, cadastrais, coletas, socios } = ficha
  const enderecoColeta = (pedidoId: string) => urlColetaGestor(pedidoId, 1, { tipo: 'ficha', id: empresa.id, aba: 'historico', origem: origemHistorico })
  return <>
    {empresa.situacao === 'arquivada' && <Alert role="note">Arquivo histórico, somente consulta. Retornos cancelados na agenda ativa. Os dados e as datas originais permanecem no histórico.</Alert>}
    <div className={styles.colunas}><AbasFicha abaInicial={abaInicial} dados={<div className={lateral ? styles.detalhesLateral : styles.detalhes}>
      <Card><CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader><CardContent>
        <dl className={styles.dados}>
          <dt>CNPJ</dt><dd>{formatarCnpj(empresa.cnpj)}</dd>
          <dt>Contato</dt><dd>{empresa.contatoNome ?? 'Não informado'}</dd>
          <dt>Telefone</dt><dd>{formatarTelefone(empresa.telefone)}</dd>
          <dt>E-mail</dt><dd>{empresa.email ?? 'Não informado'}</dd>
          <dt>CNAE</dt><dd>{empresa.cnae ?? 'Não informado'}</dd>
          <dt>CEP</dt><dd>{empresa.cep ?? 'Não informado'}</dd>
        </dl>
      </CardContent></Card>
      <DadosCadastrais dados={cadastrais} />
      <DadosSocios linhas={socios} />
      <Card><CardHeader><CardTitle>Acompanhamento</CardTitle></CardHeader><CardContent>
        <dl className={styles.dados}>
          <dt>Vendedor responsável</dt><dd>{empresa.responsavel ?? 'Sem vendedor responsável'}{empresa.responsavel && !empresa.responsavelAtivo ? <Badge variant="warning">Desativado</Badge> : null}</dd>
          <dt>Próximo passo</dt><dd>{empresa.proximoPasso ?? 'Não registrado'}</dd>
          <dt>Próximo retorno</dt><dd>{empresa.retorno ? dataCivil(empresa.retorno) : 'Sem retorno agendado'}</dd>
        </dl>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Grupos de origem</CardTitle></CardHeader><CardContent>
        {empresa.grupos.length ? <ul className={styles.grupos}>{empresa.grupos.map(g => <li key={g.id}><span>{g.nome}</span><Badge variant={g.ativo ? 'success' : 'outline'}>{g.ativo ? 'Ativo' : 'Desativado'}</Badge></li>)}</ul> : <p>Nenhum grupo vinculado.</p>}
      </CardContent></Card>
    </div>} historico={<div className={lateral ? styles.detalhesLateral : undefined}><HistoricoGoogleEmpresa coletas={coletas} enderecoColeta={enderecoColeta} />{empresa.arquivo && <Card><CardHeader><CardTitle>Arquivamento e negociações</CardTitle></CardHeader><CardContent><p>Arquivada em {horario.format(new Date(empresa.arquivo.arquivadaEm))}.</p><ul>{empresa.arquivo.negociacoes.map(n => <li key={n.id}>{rotuloSituacao(n.etapa as 'primeiro_contato' | 'em_negociacao' | 'proposta_enviada')} · {n.vendedor ?? 'Autor preservado'} · {n.encerramento === 'arquivamento_legado' ? 'Encerrada por arquivamento da base antiga' : n.encerramento}{n.encerradaEm ? ` em ${horario.format(new Date(n.encerradaEm))}` : ''}</li>)}</ul></CardContent></Card>}<Card><CardHeader><CardTitle>Histórico de atendimentos</CardTitle></CardHeader><CardContent>
      {!historico.ok ? <Alert variant="danger">Não foi possível carregar o histórico. Atualize a página para tentar novamente.</Alert> : !historico.contatos.length ? <p>Nenhum atendimento registrado.</p> :
        <LinhaDoTempo contatos={historico.contatos} />}
    </CardContent></Card></div>} /></div>
  </>
}
