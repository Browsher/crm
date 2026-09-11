'use client'

import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Textarea } from '@/src/components/ui/textarea'
import styles from './galeria.module.css'

type Tema = 'light' | 'dark' | 'system'
type Etapa = 0 | 1 | 2

const secoes = [
  ['tipografia', 'Tipografia'],
  ['botoes', 'Botões'],
  ['filtros', 'Filtros'],
  ['empresas', 'Empresas'],
  ['avisos', 'Avisos'],
  ['dialogo', 'Diálogo'],
  ['fluxo', 'Fluxo simulado'],
] as const

const empresas = [
  { nome: 'Aurora Papelaria Ltda.', cnae: '4761-0/03', uf: 'SP', cidade: 'Campinas', bairro: 'Cambuí', estado: 'Disponível', variante: 'success' as const },
  { nome: 'Oficina Horizonte Ltda.', cnae: '4520-0/01', uf: 'SP', cidade: 'Jundiaí', bairro: 'Centro', estado: 'Reservada para você', variante: 'warning' as const },
  { nome: 'Café Cedro Comércio Ltda.', cnae: '5611-2/03', uf: 'SP', cidade: 'Sorocaba', bairro: 'Centro', estado: 'Indisponível', detalhe: 'Com outro vendedor: Marina Costa', variante: 'outline' as const },
]

const filtrosIniciais = { nome: '', cnae: '', uf: '', cidade: '', bairro: '' }

export function Galeria() {
  const [tema, setTema] = useState<Tema>('system')
  const [menuAberto, setMenuAberto] = useState(false)
  const [resposta, setResposta] = useState('')
  const [respostaFiltros, setRespostaFiltros] = useState('')
  const [respostaDialogo, setRespostaDialogo] = useState('')
  const [empresaAberta, setEmpresaAberta] = useState<string | null>(null)
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
    <div className={`crm-ui ${styles.shell}`} data-theme={tema}>
      <aside className={`${styles.sidebar} ${menuAberto ? styles.sidebarOpen : ''}`} aria-label="Seções da galeria">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <div><strong>CRM</strong><span>Referência visual</span></div>
        </div>
        <nav>
          {secoes.map(([id, nome]) => (
            <a key={id} href={`#${id}`} onClick={() => setMenuAberto(false)}>{nome}</a>
          ))}
        </nav>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <Button variant="ghost" size="icon" className={styles.menuButton} aria-label="Abrir menu" aria-expanded={menuAberto} onClick={() => setMenuAberto((aberto) => !aberto)}>
            <span aria-hidden="true">☰</span>
          </Button>
          <div className={styles.topbarTitle}>Padrão visual</div>
          <div className={styles.themeControl}>
            <Label htmlFor="tema">Tema</Label>
            <NativeSelect id="tema" aria-label="Tema da galeria" value={tema} onChange={(evento) => setTema(evento.target.value as Tema)}>
              <option value="system">Sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </NativeSelect>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.intro}>
            <div>
              <h1>Galeria do CRM</h1>
              <p>Componentes para uma rotina de prospecção clara, calma e direta.</p>
            </div>
            <Badge variant="outline">Somente demonstração</Badge>
          </div>

          <Alert>
            <AlertTitle>Dados fictícios e estado local</AlertTitle>
            <AlertDescription>Os exemplos desta página não consultam, reservam ou alteram empresas reais.</AlertDescription>
          </Alert>

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
              <Button disabled>Reservar para ligar</Button>
            </div>
            <p className={styles.help}>Reservar para ligar está desabilitado porque a empresa já está reservada.</p>
            {resposta && <p className={styles.feedback} role="status">{resposta}</p>}
          </Secao>

          <Secao id="filtros" titulo="Filtros" descricao="Combinações de exemplo para localizar uma empresa.">
            <div className={styles.filters}>
              <Campo label="Nome da empresa" id="nome"><Input id="nome" placeholder="Ex.: Aurora Papelaria" value={filtros.nome} onInput={(evento) => setFiltros({ ...filtros, nome: evento.currentTarget.value })} /></Campo>
              <Campo label="CNAE" id="cnae"><NativeSelect id="cnae" value={filtros.cnae} onChange={(evento) => setFiltros({ ...filtros, cnae: evento.target.value })}><option value="">Todos</option><option value="4761-0/03">Comércio varejista de artigos de papelaria</option><option value="5611-2/03">Lanchonetes e casas de chá</option></NativeSelect></Campo>
              <Campo label="Estado" id="estado"><NativeSelect id="estado" value={filtros.uf} onChange={(evento) => setFiltros({ ...filtros, uf: evento.target.value })}><option value="">Todos</option><option value="SP">São Paulo</option><option value="MG">Minas Gerais</option></NativeSelect></Campo>
              <Campo label="Cidade" id="cidade"><NativeSelect id="cidade" value={filtros.cidade} onChange={(evento) => setFiltros({ ...filtros, cidade: evento.target.value })}><option value="">Todas</option><option>Campinas</option><option>Jundiaí</option><option>Sorocaba</option></NativeSelect></Campo>
              <Campo label="Bairro" id="bairro"><NativeSelect id="bairro" value={filtros.bairro} onChange={(evento) => setFiltros({ ...filtros, bairro: evento.target.value })}><option value="">Todos</option><option>Centro</option><option>Cambuí</option></NativeSelect></Campo>
            </div>
            <div className={styles.filterActions}><Button onClick={() => { setFiltrosAplicados(filtros); setRespostaFiltros('Filtros aplicados aos dados fictícios.') }}>Aplicar filtros</Button><Button variant="outline" onClick={limparFiltros}>Limpar</Button></div>
            {respostaFiltros && <p className={styles.feedback} role="status">{respostaFiltros}</p>}
            <div className={styles.stateExamples}>
              <Campo label="Telefone com erro" id="telefone"><Input id="telefone" defaultValue="(19) 33" aria-invalid aria-describedby="telefone-erro" /><span id="telefone-erro" className={styles.error}>Informe um telefone com DDD.</span></Campo>
              <Campo label="Código da reserva" id="codigo-reserva"><Input id="codigo-reserva" value="RES-0184" readOnly aria-describedby="codigo-ajuda" /><span id="codigo-ajuda" className={styles.help}>Somente leitura. O valor pode ser copiado.</span></Campo>
            </div>
          </Secao>

          <Secao id="empresas" titulo="Empresas" descricao="Situação sempre escrita, sem depender apenas da cor.">
            <div className={styles.companyGrid} data-testid="company-list">
              {empresasFiltradas.map((empresa) => (
                <Card key={empresa.nome}>
                  <CardHeader><CardTitle>{empresa.nome}</CardTitle><CardDescription>{empresa.cidade}, {empresa.uf}</CardDescription></CardHeader>
                  <CardContent>
                    <Badge variant={empresa.variante}>{empresa.estado}</Badge>
                    {empresa.detalhe && <><p className={styles.companyDetail}>{empresa.detalhe}</p><Badge variant="outline">Ausente</Badge></>}
                    {empresaAberta === empresa.nome && <dl className={styles.companyExample}><div><dt>Telefone fictício</dt><dd>(15) 3333-0184</dd></div><div><dt>CNAE</dt><dd>{empresa.cnae}</dd></div><div><dt>Bairro</dt><dd>{empresa.bairro}</dd></div></dl>}
                  </CardContent>
                  <CardFooter><Button variant="outline" size="sm" aria-expanded={empresaAberta === empresa.nome} onClick={() => setEmpresaAberta(empresaAberta === empresa.nome ? null : empresa.nome)}>{empresaAberta === empresa.nome ? 'Fechar exemplo' : 'Ver exemplo'}</Button></CardFooter>
                </Card>
              ))}
            </div>
            {empresasFiltradas.length === 0 && <Card>
              <CardHeader><CardTitle>Nenhuma empresa encontrada</CardTitle><CardDescription>Altere um filtro para ampliar a busca nos dados fictícios.</CardDescription></CardHeader>
              <CardFooter><Button variant="outline" size="sm" onClick={limparFiltros}>Limpar filtros</Button></CardFooter>
            </Card>}
          </Secao>

          <Secao id="avisos" titulo="Avisos e carregamento" descricao="Estados que orientam a próxima ação.">
            <div className={styles.alertGrid}>
              <Alert variant="warning"><AlertTitle>Reserva expirada</AlertTitle><AlertDescription>A tentativa continua registrada. As anotações permanecem editáveis e podem ser copiadas.</AlertDescription><div className={styles.expiredNotes}><Label htmlFor="anotacoes-expiradas">Anotações da tentativa</Label><Textarea id="anotacoes-expiradas" defaultValue="Responsável retorna depois das 15h." /></div></Alert>
              <Alert variant="success"><AlertTitle>Resultado registrado</AlertTitle><AlertDescription>A empresa voltou para a fila conforme o resultado escolhido.</AlertDescription></Alert>
            </div>
            <div className={styles.loadingCard} aria-label="Exemplo de carregamento"><Skeleton className={styles.skeletonTitle} /><Skeleton className={styles.skeletonLine} /><Skeleton className={styles.skeletonShort} /></div>
          </Secao>

          <Secao id="dialogo" titulo="Diálogo" descricao="Uma confirmação curta mantém a decisão e as ações no mesmo contexto.">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Abrir confirmação</Button></DialogTrigger>
              <DialogContent theme={tema}>
                <DialogHeader><DialogTitle>Devolver empresa para a fila?</DialogTitle><DialogDescription>Este é um exemplo local. Nenhuma reserva real será alterada.</DialogDescription></DialogHeader>
                <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><DialogClose asChild><Button onClick={() => setRespostaDialogo('Exemplo confirmado. Nenhuma reserva real foi alterada.')}>Confirmar exemplo</Button></DialogClose></DialogFooter>
              </DialogContent>
            </Dialog>
            {respostaDialogo && <p className={styles.feedback} role="status">{respostaDialogo}</p>}
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
      </div>
    </div>
  )
}

function Secao({ id, titulo, descricao, children }: { id: string, titulo: string, descricao: string, children: React.ReactNode }) {
  return <section id={id} className={styles.section}><header><h2>{titulo}</h2><p>{descricao}</p></header><div className={styles.sectionBody}>{children}</div></section>
}

function Campo({ label, id, children }: { label: string, id: string, children: React.ReactNode }) {
  return <div className={styles.field}><Label htmlFor={id}>{label}</Label>{children}</div>
}
