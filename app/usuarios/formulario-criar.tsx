'use client'
import { useActionState, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Alert } from '@/src/components/ui/alert'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { criarUsuarioAcao, type EstadoCriar } from './acoes'
import { SenhaProvisoria } from './senha'
import styles from './usuarios.module.css'

const inicial: EstadoCriar = { erro: null, criado: null }
export function FormularioCriar() {
  const [aberto, setAberto] = useState(false)
  const [pendente, setPendente] = useState(false)
  return <Dialog open={aberto} onOpenChange={valor => { if (!pendente) setAberto(valor) }}>
    <DialogTrigger asChild><Button>Novo usuário</Button></DialogTrigger>
    {aberto && <Criacao fechar={() => setAberto(false)} informarPendencia={setPendente} />}
  </Dialog>
}
function Criacao({ fechar, informarPendencia }: { fechar: () => void; informarPendencia: (valor: boolean) => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('vendedor')
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoCriar, form: FormData) => {
    informarPendencia(true)
    try { return await criarUsuarioAcao(anterior, form) }
    finally { informarPendencia(false) }
  }, inicial)
  return <DialogContent theme={useTemaCrm()} showCloseButton={!pendente}
    onEscapeKeyDown={e => { if (pendente) e.preventDefault() }} onPointerDownOutside={e => { if (pendente) e.preventDefault() }}>
    <DialogHeader><DialogTitle>{estado.criado ? 'Usuário criado' : 'Novo usuário'}</DialogTitle><DialogDescription>Crie o acesso e entregue a senha provisória à pessoa.</DialogDescription></DialogHeader>
    {estado.criado ? <SenhaProvisoria nome={estado.criado.nome} senha={estado.criado.senhaProvisoria} concluir={fechar} /> :
      <form action={acao} className={styles.formulario}>
        <label>Nome<Input name="nome" required value={nome} onChange={e => setNome(e.target.value)} disabled={pendente} /></label>
        <label>E-mail<Input name="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={pendente} /></label>
        <fieldset disabled={pendente}><legend>Papel</legend><div className={styles.acoes}>
          <label><input type="radio" name="papel" value="vendedor" checked={papel === 'vendedor'} onChange={() => setPapel('vendedor')} /> Vendedor</label>
          <label><input type="radio" name="papel" value="gestor" checked={papel === 'gestor'} onChange={() => setPapel('gestor')} /> Gestor</label>
        </div></fieldset>
        {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
        <DialogFooter><Button type="button" variant="outline" disabled={pendente} onClick={fechar}>Cancelar</Button><Button type="submit" disabled={pendente}>{pendente ? 'Criando…' : 'Criar usuário'}</Button></DialogFooter>
      </form>}
  </DialogContent>
}
