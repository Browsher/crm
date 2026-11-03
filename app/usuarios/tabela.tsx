'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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

import { lerRecorteUsuarios, urlPerfilUsuario, urlUsuarios, USUARIOS_POR_PAGINA, type RecorteUsuarios } from '@/src/lib/recorte-usuarios'

export function TabelaUsuarios({ lista, euId, inicial }: { lista: Usuario[]; euId: string; inicial: RecorteUsuarios }) {
  const consulta = useSearchParams().toString()
  const [recorte, setRecorte] = useState(inicial)
  const { busca, papel, situacao } = recorte
  useEffect(() => {
    // O Next também observa os updates locais do histórico. Só aplique a
    // consulta depois de ela coincidir com o endereço confirmado no navegador.
    const quadro = requestAnimationFrame(() => {
      const atual = new URLSearchParams(location.search)
      if (location.pathname !== '/usuarios' || atual.toString() !== consulta) return
      const novo = lerRecorteUsuarios(atual)
      // O recorte pode ter espaços de uma edição que ainda está em curso.
      setRecorte(anterior => urlUsuarios(anterior) === urlUsuarios(novo) ? anterior : novo)
    })
    return () => cancelAnimationFrame(quadro)
  }, [consulta])
  const [selecao, setSelecao] = useState<{ usuario: Usuario; tipo: Acao } | null>(null)
  const [pendente, setPendente] = useState(false)
  const acionador = useRef<HTMLButtonElement | null>(null)
  const campoBusca = useRef<HTMLInputElement>(null)
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const visiveis = lista.filter(u => (!termo || `${u.nome} ${u.email}`.toLocaleLowerCase('pt-BR').includes(termo)) &&
    (papel === 'todos' || u.papel === papel) && (situacao === 'todos' || u.ativo === (situacao === 'ativos')))
  const paginas = Math.max(1, Math.ceil(visiveis.length / USUARIOS_POR_PAGINA))
  const pagina = Math.min(recorte.pagina, paginas)
  const usuariosDaPagina = visiveis.slice((pagina - 1) * USUARIOS_POR_PAGINA, pagina * USUARIOS_POR_PAGINA)
  function fechar() { setSelecao(null) }
  function atualizar(novo: RecorteUsuarios, paginar = false) {
    setRecorte(novo)
    const href = urlUsuarios(novo)
    if (href === location.pathname + location.search) return
    if (paginar) history.pushState(null, '', href)
    else history.replaceState(null, '', href)
  }
  function limparFiltros() { atualizar(lerRecorteUsuarios({})) }
  function linkPagina(p: number, nome: string) {
    const novo = { ...recorte, pagina: p }
    return <Button asChild variant="outline"><Link href={urlUsuarios(novo)} onNavigate={e => {
      e.preventDefault()
      atualizar(novo, true)
    }}>{nome}</Link></Button>
  }
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Usuários" descricao="Gerencie os acessos da sua equipe." acoes={<FormularioCriar />} />
    {gestorUnico(lista) && <Alert variant="warning" role="note">Você é o único gestor ativo. Mantenha seu acesso seguro; a recuperação exige suporte técnico.</Alert>}
    <section aria-label="Filtros de usuários"><PainelFiltros acoes={<Button variant="outline" onClick={limparFiltros}>Limpar filtros</Button>}>
      <div><label>Buscar usuário<Input ref={campoBusca} name="busca" placeholder="Nome ou e-mail" value={busca} maxLength={160} onChange={e => atualizar({ ...recorte, busca: e.target.value, pagina: 1 })} /></label></div>
      <div><label>Papel<NativeSelect name="papelFiltro" value={papel} onChange={e => atualizar({ ...recorte, papel: lerRecorteUsuarios({ papel: e.target.value }).papel, pagina: 1 })}><option value="todos">Todos os papéis</option><option value="gestor">Gestor</option><option value="vendedor">Vendedor</option></NativeSelect></label></div>
      <div><label>Situação<NativeSelect name="situacao" value={situacao} onChange={e => atualizar({ ...recorte, situacao: lerRecorteUsuarios({ situacao: e.target.value }).situacao, pagina: 1 })}><option value="todos">Ativos e inativos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></NativeSelect></label></div>
    </PainelFiltros></section>
    <p className={styles.muted}>{visiveis.length} de {lista.length} usuários</p>
    <div role="region" aria-label="Lista de usuários" tabIndex={0}>
      <Table aria-label="Acessos da equipe" className={`${styles.tabela} crm-registros`}><TableHeader><TableRow><TableHead scope="col">Usuário</TableHead><TableHead scope="col">Papel</TableHead><TableHead scope="col">Situação</TableHead><TableHead scope="col">Senha</TableHead><TableHead scope="col">Ações</TableHead></TableRow></TableHeader>
        <TableBody>{usuariosDaPagina.map(u => <TableRow key={u.id}>
          <TableCell data-label="Usuário"><strong>{u.nome}</strong> {u.id === euId && <Badge variant="outline">Você</Badge>}<span className={styles.email}>{u.email}</span></TableCell>
          <TableCell data-label="Papel"><Badge variant="outline">{u.papel === 'gestor' ? 'Gestor' : 'Vendedor'}</Badge></TableCell><TableCell data-label="Situação"><Badge variant={u.ativo ? 'success' : 'outline'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge></TableCell>
          <TableCell data-label="Senha">{u.senhaProvisoriaPendente ? <Badge variant="warning">Troca pendente</Badge> : 'Definida'}</TableCell>
          <TableCell data-label="Ações"><div className={styles.acoes}>{u.papel === 'vendedor' && u.ativo && <Button asChild size="sm" variant="outline"><Link href={urlPerfilUsuario(u.id, { ...recorte, pagina })} aria-label={`Ver perfil de ${u.nome}`}>Ver perfil</Link></Button>}{acoesDe(u, euId).map(tipo => <Button key={tipo} size="sm" variant="outline" onClick={e => { acionador.current = e.currentTarget; setSelecao({ usuario: u, tipo }) }}>{ROTULO[tipo](u)}</Button>)}{u.id === euId && <span className={styles.muted}>Sua conta</span>}</div></TableCell>
        </TableRow>)}</TableBody></Table>
    </div>
    {paginas > 1 && <nav aria-label="Páginas dos usuários" className={styles.acoes}>
      <span>Página {pagina} de {paginas}</span>
      {pagina > 1 && linkPagina(pagina - 1, 'Anterior')}
      {pagina < paginas && linkPagina(pagina + 1, 'Próxima')}
    </nav>}
    {visiveis.length === 0 && <EstadoVazio titulo="Nenhum usuário encontrado" descricao="Experimente outro nome ou ajuste os filtros." acao={{ rotulo: 'Limpar filtros', aoAcionar: limparFiltros, variante: 'outline' }} />}
    <Dialog open={selecao !== null} onOpenChange={aberto => { if (!aberto && !pendente) fechar() }}>
      {selecao && <ConfirmarAcao usuario={selecao.usuario} tipo={selecao.tipo} fechar={fechar} informarPendencia={setPendente}
        devolverFoco={() => { (acionador.current?.isConnected ? acionador.current : campoBusca.current)?.focus() }} />}
    </Dialog>
  </main>
}
