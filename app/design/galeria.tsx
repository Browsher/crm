'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import { CardEmpresa } from '@/src/components/crm/card-empresa'
import { EmpresaDetalhes } from '@/src/components/crm/empresa-detalhes'
import { CardSemInteresse, type EstadoDescarte } from '@/app/funil/card-sem-interesse'
import { detalhesSnapshot, rotuloSituacao, type ResumoEmpresa } from '@/src/lib/empresa-visual'
import { ETAPAS_FUNIL } from '@/src/lib/comercial'
import empresaStyles from '@/src/components/crm/empresa.module.css'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Textarea } from '@/src/components/ui/textarea'
import { AbasFicha } from '@/src/components/crm/abas-ficha'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { PainelFiltros } from '@/src/components/crm/painel-filtros'
import { useTemaCrm } from '@/src/components/crm/tema'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/src/components/ui/table'
import styles from './galeria.module.css'

type Etapa = 0 | 1 | 2

const secoes = [
  ['tipografia', 'Tipografia'],
  ['botoes', 'Botões'],
  ['filtros', 'Filtros'],
  ['empresas', 'Empresas'],
  ['funil', 'Funil e arquivo'],
  ['tabelas', 'Tabelas'],
  ['ficha', 'Ficha e histórico'],
  ['avisos', 'Avisos'],
  ['dialogo', 'Diálogo'],
  ['fluxo', 'Fluxo simulado'],
] as const

const baseEmpresa: ResumoEmpresa = { referencia: {tipo:'cadastro',empresaId:'exemplo'},id:'exemplo',nome:'',cnpj:null,cnae:null,atividade:null,uf:null,cidade:null,bairro:null,origens:[],recebidaEm:null,situacao:'a_contatar',versao:1,negociacaoId:null }
const empresas: ResumoEmpresa[] = [
  { ...baseEmpresa, id:'aurora',referencia:{tipo:'cadastro',empresaId:'aurora'},nome: 'Aurora Papelaria Ltda.', cnae: '4761-0/03', uf: 'SP', cidade: 'Campinas', bairro: 'Cambuí',origens:['banco'],recebidaEm:'2026-10-29' },
  { ...baseEmpresa,id:'horizonte',referencia:{tipo:'cadastro',empresaId:'horizonte'},nome: 'Oficina Horizonte Serviços e Comércio de Peças para Veículos de Longa Distância Ltda.', cnae: '4520-0/01', uf: 'SP', cidade: 'Jundiaí', bairro: 'Centro',situacao:'cliente',origens:['google','banco'] },
  { ...baseEmpresa,id:'cedro',referencia:{tipo:'cadastro',empresaId:'cedro'},nome: 'Café Cedro Comércio Ltda.',situacao:'indisponivel',motivoIndisponibilidade:'outro_responsavel',versao:null },
]

const filtrosIniciais = { nome: '', cnae: '', uf: '', cidade: '', bairro: '' }

export function Galeria() {
  const tema = useTemaCrm()
  const [resposta, setResposta] = useState('')
  const [respostaFiltros, setRespostaFiltros] = useState('')
  const [respostaDialogo, setRespostaDialogo] = useState('')
  const [empresaAberta, setEmpresaAberta] = useState<ResumoEmpresa | null>(null)
  const [descarte, setDescarte] = useState<EstadoDescarte>('repouso')
  const [carregando, setCarregando] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>(0)
  const [anotacoes, setAnotacoes] = useState('Cliente pediu retorno após conferir a agenda.')
  const [filtros, setFiltros] = useState(filtrosIniciais)
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosIniciais)

  const empresasFiltradas = empresas.filter((empresa) => {
    const nomeConfere = empresa.nome.toLocaleLowerCase('pt-BR').includes(filtrosAplicados.nome.toLocaleLowerCase('pt-BR'))
    return nomeConfere && (!filtrosAplicados.cnae || empresa.cnae === filtrosAplicados.cnae)
      && (!filtrosAplicados.uf || empresa.uf === filtrosAplicados.uf)
      && (!filtrosAplicados.cidade || empresa.cidade === filtrosAplicados.cidade)
      && (!filtrosAplicados.bairro || empresa.bairro === filtrosAplicados.bairro)
  })

  function limparFiltros() {
    setFiltros(filtrosIniciais)
    setFiltrosAplicados(filtrosIniciais)
    setRespostaFiltros('Filtros fictícios limpos. A lista foi restaurada.')
  }

  function buscarCliente() {
    setCarregando(true)
    setResposta('')
    window.setTimeout(() => {
      setCarregando(false)
      setResposta('Cliente encontrado. A consulta está pronta.')
      setEtapa(1)
    }, 700)
  }

  function registrarResultado() {
    setResposta('Resultado preparado localmente. Nenhum dado foi enviado.')
    setEtapa(2)
  }

  function voltar() {
    setEtapa((atual) => Math.max(0, atual - 1) as Etapa)
  }

  return (
    <main className={styles.main}>
      <CabecalhoPagina titulo="Galeria do CRM" descricao="Componentes para uma rotina de prospecção clara, calma e direta." acoes={<Badge variant="outline">Somente demonstração</Badge>} />
      <nav className={styles.sectionNav} aria-label="Seções da galeria">
        {secoes.map(([id, nome]) => <a key={id} href={`#${id}`}>{nome}</a>)}
      </nav>

          <Alert>
            <AlertTitle>Dados fictícios e estado local</AlertTitle>
            <AlertDescription>Os exemplos desta página não consultam ou alteram empresas reais.</AlertDescription>
          </Alert>

          <section id="ficha" className={styles.section}>
            <header><h2>Ficha e histórico</h2><p>Informações fictícias para demonstrar as abas do novo padrão.</p></header>
            <AbasFicha dados={<>
              <p>Contato principal: Mariana, da Aurora Papelaria. Dados fictícios.</p>
              <Campo label="Nota da ficha" id="nota-ficha"><Textarea id="nota-ficha" aria-label="Nota da ficha" defaultValue="Cliente pediu retorno após conferir a agenda." /></Campo>
            </>} historico={<p>Ligação de demonstração: retorno combinado com a responsável.</p>} />
          </section>

          <Secao id="tipografia" titulo="Tipografia" descricao="Hierarquia curta para leitura rápida durante a ligação.">
            <div className={styles.typeSample}>
              <div><span>Título de página, 28 px</span><h2>Fila de prospecção</h2></div>
              <div><span>Título de seção, 18 px</span><h3>Dados da empresa</h3></div>
              <div><span>Texto e ação, 14 px</span><p>Confira o telefone e registre o resultado da conversa.</p></div>
              <div><span>Texto auxiliar, 12 px</span><small>Atualizado há poucos segundos</small></div>
            </div>
          </Secao>

          <Secao id="botoes" titulo="Botões e estados" descricao="Uma ação principal por contexto, com respostas claras.">
            <div className={styles.row}>
              <Button onClick={() => setResposta('Ação principal simulada.')}>Ação principal</Button>
              <Button variant="outline" onClick={() => setResposta('Ação secundária simulada.')}>Ação secundária</Button>
              <Button variant="ghost" onClick={() => setResposta('Navegação de exemplo. Você continua na galeria.')}>Voltar à fila</Button>
              <Button variant="destructive" onClick={() => setResposta('Exclusão simulada. Nenhum dado foi removido.')}>Excluir exemplo</Button>
              <Button disabled>Iniciar atendimento</Button>
            </div>
            <p className={styles.help}>Iniciar atendimento está desabilitado enquanto os dados são atualizados.</p>
            {resposta && <p className={styles.feedback} role="status">{resposta}</p>}
          </Secao>

          <Secao id="filtros" titulo="Filtros" descricao="Combinações de exemplo para localizar uma empresa.">
            <PainelFiltros acoes={<><Button onClick={() => { setFiltrosAplicados(filtros); setRespostaFiltros('Filtros aplicados aos dados fictícios.') }}>Aplicar filtros</Button><Button variant="outline" onClick={limparFiltros}>Limpar</Button></>}>
              <Campo label="Nome da empresa" id="nome"><Input id="nome" placeholder="Ex.: Aurora Papelaria" value={filtros.nome} onInput={(evento) => setFiltros({ ...filtros, nome: evento.currentTarget.value })} /></Campo>
              <Campo label="CNAE" id="cnae"><NativeSelect id="cnae" value={filtros.cnae} onChange={(evento) => setFiltros({ ...filtros, cnae: evento.target.value })}><option value="">Todos</option><option value="4761-0/03">Comércio varejista de artigos de papelaria</option><option value="5611-2/03">Lanchonetes e casas de chá</option></NativeSelect></Campo>
              <Campo label="Estado" id="estado"><NativeSelect id="estado" value={filtros.uf} onChange={(evento) => setFiltros({ ...filtros, uf: evento.target.value })}><option value="">Todos</option><option value="SP">São Paulo</option><option value="MG">Minas Gerais</option></NativeSelect></Campo>
              <Campo label="Cidade" id="cidade"><NativeSelect id="cidade" value={filtros.cidade} onChange={(evento) => setFiltros({ ...filtros, cidade: evento.target.value })}><option value="">Todas</option><option>Campinas</option><option>Jundiaí</option><option>Sorocaba</option></NativeSelect></Campo>
              <Campo label="Bairro" id="bairro"><NativeSelect id="bairro" value={filtros.bairro} onChange={(evento) => setFiltros({ ...filtros, bairro: evento.target.value })}><option value="">Todos</option><option>Centro</option><option>Cambuí</option></NativeSelect></Campo>
            </PainelFiltros>
            {respostaFiltros && <p className={styles.feedback} role="status">{respostaFiltros}</p>}
            <div className={styles.stateExamples}>
              <Campo label="Telefone com erro" id="telefone"><Input id="telefone" defaultValue="(19) 33" aria-invalid aria-describedby="telefone-erro" /><span id="telefone-erro" className={styles.error}>Informe um telefone com DDD.</span></Campo>
              <Campo label="Código da empresa" id="codigo-empresa"><Input id="codigo-empresa" value="EMP-0184" readOnly aria-describedby="codigo-ajuda" /><span id="codigo-ajuda" className={styles.help}>Somente leitura. O valor pode ser copiado.</span></Campo>
            </div>
          </Secao>

          <Secao id="empresas" titulo="Empresas" descricao="Situação sempre escrita, sem depender apenas da cor.">
            <div className={styles.companyGrid} data-testid="company-list">
              {empresasFiltradas.map(empresa => <CardEmpresa key={empresa.id} empresa={empresa} aoVer={() => setEmpresaAberta(empresa)} aoAcionar={acao=>setRespostaDialogo(`${acao.rotulo}: demonstração local, sem alterar empresas.`)} />)}
            </div>
            {empresaAberta && <Dialog open onOpenChange={aberto=>{if(!aberto)setEmpresaAberta(null)}}><DialogContent theme={tema} className={empresaStyles.dialogo}><DialogHeader><DialogTitle>Ver empresa</DialogTitle><DialogDescription>Dados fictícios para demonstração.</DialogDescription></DialogHeader><div className={empresaStyles.corpo}><h3 className={empresaStyles.nome}>{empresaAberta.nome}</h3><EmpresaDetalhes empresa={{...detalhesSnapshot({},empresaAberta.referencia),...empresaAberta,nomeFantasia:empresaAberta.nome}} /></div></DialogContent></Dialog>}
            {respostaDialogo && <p role="status">{respostaDialogo}</p>}
            {empresasFiltradas.length === 0 && <EstadoVazio titulo="Nenhuma empresa encontrada" descricao="Altere um filtro para ampliar a busca nos dados fictícios." acao={{ rotulo: 'Limpar filtros', variante: 'outline', aoAcionar: limparFiltros }} />}
          </Secao>

          <Secao id="funil" titulo="Funil e arquivo" descricao="Três etapas de negociação. Sem interesse encerra a negociação e fica no arquivo.">
            <div className={styles.companyGrid}>{ETAPAS_FUNIL.map(etapa=><Card key={etapa} data-etapa-funil={etapa}><CardHeader><CardTitle>{rotuloSituacao(etapa)}</CardTitle></CardHeader><CardContent><p>Nenhuma negociação de exemplo.</p></CardContent></Card>)}</div>
            <CardSemInteresse estado={descarte} total={descarte==='sucesso'?1:0} aceitaArraste={false} aoMudarSobre={()=>{}} aoSoltar={()=>{}} />
            <div className={styles.row}><Button variant="outline" onClick={()=>setDescarte('sucesso')}>Simular arquivamento</Button><Button variant="ghost" onClick={()=>setDescarte('repouso')}>Reiniciar exemplo</Button></div>
          </Secao>

          <Secao id="tabelas" titulo="Tabelas" descricao="Os mesmos registros fictícios em linhas confortáveis, empilhadas no celular.">
            <Table className="crm-registros" aria-label="Empresas de demonstração">
              <TableHeader><TableRow><TableHead scope="col">Empresa</TableHead><TableHead scope="col">Localização</TableHead><TableHead scope="col">Situação</TableHead></TableRow></TableHeader>
              <TableBody>{empresasFiltradas.map(empresa => <TableRow key={empresa.nome}>
                <TableCell data-label="Empresa"><strong>{empresa.nome}</strong></TableCell>
                <TableCell data-label="Localização">{empresa.cidade}, {empresa.uf}</TableCell>
                <TableCell data-label="Situação"><Badge variant="outline">{rotuloSituacao(empresa.situacao)}</Badge></TableCell>
              </TableRow>)}</TableBody>
            </Table>
            {empresasFiltradas.length === 0 && <p role="status">Nenhum registro para os filtros aplicados.</p>}
          </Secao>

          <Secao id="avisos" titulo="Avisos e carregamento" descricao="Veja onde cada mensagem entra na tela. As ações abaixo simulam a rotina, sem enviar dados.">
            <ExemplosAvisos />
          </Secao>

          <Secao id="dialogo" titulo="Diálogo: confirmar antes de trocar" descricao="Aparece sobre a tela quando você clica em Próxima e há anotações não salvas. Cancelar mantém a empresa e as anotações; continuar confirma o descarte.">
            <Card>
              <CardHeader><CardTitle>Consultar empresa</CardTitle><CardDescription>Exemplo do passo 2 da Fila</CardDescription></CardHeader>
              <CardContent className={styles.scenarioContent}>
                <strong>Aurora Papelaria Ltda.</strong>
                <div className={styles.notePreview}><strong>Anotações não salvas</strong><p>Enviar proposta e retornar na sexta de manhã.</p></div>
                <p>Experimente clicar em Próxima. A confirmação aparece no centro da tela para você decidir antes de trocar de cliente.</p>
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Próxima</Button></DialogTrigger>
              <DialogContent theme={tema}>
                <DialogHeader><DialogTitle>Trocar de empresa e descartar as anotações?</DialogTitle><DialogDescription>As anotações não salvas de Aurora Papelaria serão descartadas se você continuar. Esta é uma simulação; nenhum cliente real será alterado.</DialogDescription></DialogHeader>
                <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><DialogClose asChild><Button onClick={() => setRespostaDialogo('Troca confirmada. A próxima empresa de exemplo seria aberta; nenhum cliente real foi alterado.')}>Descartar e continuar</Button></DialogClose></DialogFooter>
              </DialogContent>
            </Dialog>
            {respostaDialogo && <p className={styles.feedback} role="status">{respostaDialogo}</p>}
              </CardContent>
            </Card>
          </Secao>

          <Secao id="fluxo" titulo="Fluxo simulado" descricao="Demonstração de componentes. O avanço ocorre somente pelas ações do atendimento.">
            <ol className={styles.steps} aria-label="Etapas da demonstração">
              {(['Puxar', 'Consultar', 'Registrar'] as const).map((nome, indice) => (
                <li key={nome} aria-current={etapa === indice ? 'step' : undefined}>
                  {indice < etapa ? <button type="button" onClick={() => setEtapa(indice as Etapa)}>{nome}</button> : <span>{nome}</span>}
                </li>
              ))}
            </ol>
            <p className={styles.currentStep}>Etapa atual: {['Puxar', 'Consultar', 'Registrar'][etapa]}</p>
            <div className={styles.flowPanel}>
              {etapa === 0 && <><h3>Próximo cliente</h3><p>Use os filtros acima ou busque uma empresa disponível.</p>{carregando && <div className={styles.inlineLoading}><Skeleton className={styles.skeletonLine} /><Skeleton className={styles.skeletonShort} /></div>}</>}
              {etapa === 1 && <><div className={styles.callHeader}><div><h3>Aurora Papelaria Ltda.</h3><p>Campinas, SP</p></div><strong>(19) 3333-0184</strong></div><Campo label="Anotações da ligação" id="anotacoes"><Textarea id="anotacoes" aria-label="Anotações da ligação" value={anotacoes} onInput={(evento) => setAnotacoes(evento.currentTarget.value)} /></Campo></>}
              {etapa === 2 && <><h3>Resultado preparado</h3><p>{anotacoes || 'Sem anotações nesta tentativa.'}</p><Alert variant="success"><AlertTitle>Simulação concluída</AlertTitle><AlertDescription>Nenhum resultado foi gravado no banco.</AlertDescription></Alert></>}
            </div>
            <div className={styles.flowActions}>
              <Button variant="outline" onClick={voltar} disabled={etapa === 0}>Voltar</Button>
              {etapa === 0 && <Button onClick={buscarCliente} disabled={carregando} aria-busy={carregando}>Buscar cliente</Button>}
              {etapa === 1 && <Button onClick={registrarResultado}>Registrar resultado</Button>}
            </div>
          </Secao>
    </main>
  )
}

function ExemplosAvisos() {
  const [busca, setBusca] = useState<'inicio' | 'carregando' | 'pronto' | 'vazio'>('inicio')
  const [salvamento, setSalvamento] = useState<'inicio' | 'erro' | 'salvando' | 'pronto'>('inicio')

  useEffect(() => {
    if (busca !== 'carregando') return
    const timer = window.setTimeout(() => setBusca('pronto'), 900)
    return () => window.clearTimeout(timer)
  }, [busca])
  useEffect(() => {
    if (salvamento !== 'salvando') return
    const timer = window.setTimeout(() => setSalvamento('pronto'), 900)
    return () => window.clearTimeout(timer)
  }, [salvamento])

  return <div className={styles.alertGrid}>
    <Card>
      <CardHeader><CardTitle>Ao localizar empresas</CardTitle><CardDescription>Passo 1: Puxar. O carregamento ocupa o lugar da lista enquanto a busca acontece.</CardDescription></CardHeader>
      <CardContent className={styles.scenarioContent}>
        <div className={styles.row}><Button onClick={() => setBusca('carregando')} disabled={busca === 'carregando'} aria-busy={busca === 'carregando'}>Simular busca</Button><Button variant="outline" disabled={busca === 'carregando'} onClick={() => setBusca('vazio')}>Simular lista vazia</Button></div>
        <div className={styles.resultPreview} aria-busy={busca === 'carregando'}>
          {busca === 'inicio' && <p>Clique em Simular busca para ver a lista carregar.</p>}
          {busca === 'carregando' && <><p role="status">Buscando empresas…</p><Skeleton className={styles.skeletonTitle} /><Skeleton className={styles.skeletonLine} /><Skeleton className={styles.skeletonShort} /></>}
          {busca === 'pronto' && <><p role="status">1 empresa encontrada</p><strong>Aurora Papelaria Ltda.</strong><p>Campinas, SP</p><Badge variant="success">Disponível</Badge></>}
          {busca === 'vazio' && <><p role="status">Nenhum resultado para estes filtros</p><p>Altere o nome ou amplie os filtros para pesquisar novamente.</p><Button variant="outline" onClick={() => setBusca('carregando')}>Ampliar busca de exemplo</Button></>}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Ao registrar uma ligação</CardTitle><CardDescription>Passo 3: Registrar. A resposta aparece junto ao formulário, mantendo suas anotações.</CardDescription></CardHeader>
      <CardContent className={styles.scenarioContent}>
        <Label htmlFor="nota-salvamento">Anotações do resultado</Label>
        <Textarea id="nota-salvamento" defaultValue="Enviar proposta amanhã pela manhã." readOnly={salvamento === 'salvando'} />
        {salvamento === 'erro' && <Alert variant="danger"><AlertTitle>Não foi possível salvar</AlertTitle><AlertDescription>Suas anotações continuam aqui. Tente novamente quando a conexão voltar.</AlertDescription></Alert>}
        {salvamento === 'salvando' && <p role="status">Salvando resultado… Aguarde a confirmação.</p>}
        {salvamento === 'pronto' && <Alert variant="success"><AlertTitle>Resultado salvo na demonstração</AlertTitle><AlertDescription>Este aviso aparece após a confirmação do salvamento. Nenhum dado real foi enviado.</AlertDescription></Alert>}
        <div className={styles.row}>
          <Button variant="outline" disabled={salvamento === 'salvando'} onClick={() => setSalvamento('erro')}>Simular falha ao salvar</Button>
          <Button disabled={salvamento === 'salvando'} aria-busy={salvamento === 'salvando'} onClick={() => setSalvamento('salvando')}>{salvamento === 'erro' ? 'Tentar salvar novamente' : 'Simular salvamento'}</Button>
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Quando o cadastro muda</CardTitle><CardDescription>Durante o atendimento. O aviso explica por que é necessário atualizar a empresa.</CardDescription></CardHeader>
      <CardContent className={styles.scenarioContent}>
        <Alert variant="warning"><AlertTitle>Empresa atualizada em outra aba</AlertTitle><AlertDescription>Atualize os dados antes de registrar. Suas anotações foram preservadas e podem ser copiadas.</AlertDescription></Alert>
        <Label htmlFor="anotacoes-expiradas">Anotações da tentativa</Label><Textarea id="anotacoes-expiradas" defaultValue="Responsável retorna depois das 15h." />
        <Button disabled>Registrar ligação</Button>
        <p className={styles.help}>Confira a situação atual da empresa antes de tentar novamente.</p>
      </CardContent>
    </Card>
  </div>
}

function Secao({ id, titulo, descricao, children }: { id: string, titulo: string, descricao: string, children: React.ReactNode }) {
  return <section id={id} className={styles.section}><header><h2>{titulo}</h2><p>{descricao}</p></header><div className={styles.sectionBody}>{children}</div></section>
}

function Campo({ label, id, children }: { label: string, id: string, children: React.ReactNode }) {
  return <div className={styles.field}><Label htmlFor={id}>{label}</Label>{children}</div>
}
