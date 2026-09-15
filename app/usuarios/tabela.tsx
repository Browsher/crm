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
  return <main className={styles.pagina}>
    <header className={styles.cabecalho}><div><h1>Usuários</h1><p className={styles.muted}>Gerencie os acessos da sua equipe.</p></div><FormularioCriar /></header>
    {gestorUnico(lista) && <Alert variant="warning" role="note">Você é o único gestor ativo. Mantenha seu acesso seguro; a recuperação exige suporte técnico.</Alert>}
    <div className={styles.filtros}>
      <label className={styles.busca}>Buscar usuário<Input ref={campoBusca} name="busca" placeholder="Nome ou e-mail" value={busca} onChange={e => setBusca(e.target.value)} /></label>
      <label>Papel<NativeSelect name="papelFiltro" value={papel} onChange={e => setPapel(e.target.value)}><option value="todos">Todos os papéis</option><option value="gestor">Gestor</option><option value="vendedor">Vendedor</option></NativeSelect></label>
      <label>Situação<NativeSelect name="situacao" value={situacao} onChange={e => setSituacao(e.target.value)}><option value="todos">Ativos e inativos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></NativeSelect></label>
      <Button variant="ghost" onClick={() => { setBusca(''); setPapel('todos'); setSituacao('todos') }}>Limpar filtros</Button>
    </div>
    <p className={styles.muted}>{visiveis.length} de {lista.length} usuários</p>
    <div className={styles.rolagem} role="region" aria-label="Lista de usuários" tabIndex={0}>
      <table className={styles.tabela}><thead><tr><th scope="col">Usuário</th><th scope="col">Papel</th><th scope="col">Situação</th><th scope="col">Senha</th><th scope="col">Ações</th></tr></thead>
        <tbody>{visiveis.map(u => <tr key={u.id}>
          <td><strong>{u.nome}</strong> {u.id === euId && <Badge variant="outline">Você</Badge>}<span className={styles.email}>{u.email}</span></td>
          <td>{u.papel === 'gestor' ? 'Gestor' : 'Vendedor'}</td><td><Badge variant={u.ativo ? 'success' : 'outline'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
          <td>{u.senhaProvisoriaPendente ? <Badge variant="warning">Troca pendente</Badge> : 'Definida'}</td>
          <td><div className={styles.acoes}>{u.papel === 'vendedor' && u.ativo && <Button asChild size="sm" variant="outline"><Link href={`/usuarios/vendedores/${u.id}`} aria-label={`Ver perfil de ${u.nome}`}>Ver perfil</Link></Button>}{acoesDe(u, euId).map(tipo => <Button key={tipo} size="sm" variant="outline" onClick={e => { acionador.current = e.currentTarget; setSelecao({ usuario: u, tipo }) }}>{ROTULO[tipo](u)}</Button>)}{u.id === euId && <span className={styles.muted}>Sua conta</span>}</div></td>
        </tr>)}</tbody></table>
    </div>
    {visiveis.length === 0 && <div className={styles.vazio}><h2>Nenhum usuário encontrado</h2><p>Experimente outro nome ou ajuste os filtros.</p></div>}
    <Dialog open={selecao !== null} onOpenChange={aberto => { if (!aberto && !pendente) fechar() }}>
      {selecao && <ConfirmarAcao usuario={selecao.usuario} tipo={selecao.tipo} fechar={fechar} informarPendencia={setPendente}
        devolverFoco={() => { (acionador.current?.isConnected ? acionador.current : campoBusca.current)?.focus() }} />}
    </Dialog>
  </main>
}
