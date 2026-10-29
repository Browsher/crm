'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { acoesDe, gestorUnico, type Usuario, type Acao } from '@/src/features/usuarios/regras'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Alert } from '@/src/components/ui/alert'
import { Dialog } from '@/src/components/ui/dialog'
import { FormularioCriar } from './formulario-criar'
import { ConfirmarAcao, ROTULO } from './linha'
import styles from './usuarios.module.css'
import { PainelFiltros } from '@/src/components/crm/painel-filtros'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/src/components/ui/table'

export function TabelaUsuarios({ lista, euId }: { lista: Usuario[]; euId: string }) {
  const [busca, setBusca] = useState('')
  const [papel, setPapel] = useState('todos')
  const [situacao, setSituacao] = useState('todos')
  const [selecao, setSelecao] = useState<{ usuario: Usuario; tipo: Acao } | null>(null)
  const [pendente, setPendente] = useState(false)
  const acionador = useRef<HTMLButtonElement | null>(null)
  const campoBusca = useRef<HTMLInputElement>(null)
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const visiveis = lista.filter(u => (!termo || `${u.nome} ${u.email}`.toLocaleLowerCase('pt-BR').includes(termo)) &&
    (papel === 'todos' || u.papel === papel) && (situacao === 'todos' || u.ativo === (situacao === 'ativos')))
  function fechar() { setSelecao(null) }
  function limparFiltros() { setBusca(''); setPapel('todos'); setSituacao('todos') }
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Usuários" descricao="Gerencie os acessos da sua equipe." acoes={<FormularioCriar />} />
    {gestorUnico(lista) && <Alert variant="warning" role="note">Você é o único gestor ativo. Mantenha seu acesso seguro; a recuperação exige suporte técnico.</Alert>}
    <section aria-label="Filtros de usuários"><PainelFiltros acoes={<Button variant="outline" onClick={limparFiltros}>Limpar filtros</Button>}>
      <div><label>Buscar usuário<Input ref={campoBusca} name="busca" placeholder="Nome ou e-mail" value={busca} onChange={e => setBusca(e.target.value)} /></label></div>
      <div><label>Papel<NativeSelect name="papelFiltro" value={papel} onChange={e => setPapel(e.target.value)}><option value="todos">Todos os papéis</option><option value="gestor">Gestor</option><option value="vendedor">Vendedor</option></NativeSelect></label></div>
      <div><label>Situação<NativeSelect name="situacao" value={situacao} onChange={e => setSituacao(e.target.value)}><option value="todos">Ativos e inativos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></NativeSelect></label></div>
    </PainelFiltros></section>
    <p className={styles.muted}>{visiveis.length} de {lista.length} usuários</p>
    <div role="region" aria-label="Lista de usuários" tabIndex={0}>
      <Table aria-label="Acessos da equipe" className={`${styles.tabela} crm-registros`}><TableHeader><TableRow><TableHead scope="col">Usuário</TableHead><TableHead scope="col">Papel</TableHead><TableHead scope="col">Situação</TableHead><TableHead scope="col">Senha</TableHead><TableHead scope="col">Ações</TableHead></TableRow></TableHeader>
        <TableBody>{visiveis.map(u => <TableRow key={u.id}>
          <TableCell data-label="Usuário"><strong>{u.nome}</strong> {u.id === euId && <Badge variant="outline">Você</Badge>}<span className={styles.email}>{u.email}</span></TableCell>
          <TableCell data-label="Papel"><Badge variant="outline">{u.papel === 'gestor' ? 'Gestor' : 'Vendedor'}</Badge></TableCell><TableCell data-label="Situação"><Badge variant={u.ativo ? 'success' : 'outline'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge></TableCell>
          <TableCell data-label="Senha">{u.senhaProvisoriaPendente ? <Badge variant="warning">Troca pendente</Badge> : 'Definida'}</TableCell>
          <TableCell data-label="Ações"><div className={styles.acoes}>{u.papel === 'vendedor' && u.ativo && <Button asChild size="sm" variant="outline"><Link href={`/usuarios/vendedores/${u.id}`} aria-label={`Ver perfil de ${u.nome}`}>Ver perfil</Link></Button>}{acoesDe(u, euId).map(tipo => <Button key={tipo} size="sm" variant="outline" onClick={e => { acionador.current = e.currentTarget; setSelecao({ usuario: u, tipo }) }}>{ROTULO[tipo](u)}</Button>)}{u.id === euId && <span className={styles.muted}>Sua conta</span>}</div></TableCell>
        </TableRow>)}</TableBody></Table>
    </div>
    {visiveis.length === 0 && <EstadoVazio titulo="Nenhum usuário encontrado" descricao="Experimente outro nome ou ajuste os filtros." acao={{ rotulo: 'Limpar filtros', aoAcionar: limparFiltros, variante: 'outline' }} />}
    <Dialog open={selecao !== null} onOpenChange={aberto => { if (!aberto && !pendente) fechar() }}>
      {selecao && <ConfirmarAcao usuario={selecao.usuario} tipo={selecao.tipo} fechar={fechar} informarPendencia={setPendente}
        devolverFoco={() => { (acionador.current?.isConnected ? acionador.current : campoBusca.current)?.focus() }} />}
    </Dialog>
  </main>
}
