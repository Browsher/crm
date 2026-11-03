'use client'
import { startTransition, useActionState, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useDescarteEdicao } from '@/src/components/crm/descarte-edicao'
import { RESULTADO_INCERTO } from '@/src/lib/edicao-administrativa'
import { Button } from '@/src/components/ui/button'
import { Choice } from '@/src/components/ui/choice'
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
  const fecharEditorRef = useRef<(() => void) | null>(null)
  return <Dialog open={aberto} onOpenChange={valor => {
    if (valor) setAberto(true)
    else fecharEditorRef.current?.()
  }}>
    <DialogTrigger asChild><Button type="button">Novo usuário</Button></DialogTrigger>
    {aberto && <Criacao fechar={() => setAberto(false)} fecharEditorRef={fecharEditorRef} />}
  </Dialog>
}
function Criacao({ fechar, fecharEditorRef }: { fechar: () => void; fecharEditorRef: RefObject<(() => void) | null> }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('vendedor')
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoCriar, form: FormData): Promise<EstadoCriar> => {
    return criarUsuarioAcao(anterior, form).catch(() => ({ erro: RESULTADO_INCERTO, criado: null, incerto: true }))
  }, inicial)
  const { pedir, confirmacao } = useDescarteEdicao(!estado.criado && (nome !== '' || email !== '' || papel !== 'vendedor'), pendente)
  const pedirFechamento = () => pedir(fechar)
  useLayoutEffect(() => {
    fecharEditorRef.current = pedirFechamento
    return () => { fecharEditorRef.current = null }
  })
  return <DialogContent theme={useTemaCrm()} showCloseButton={!pendente}
    onEscapeKeyDown={e => { if (pendente) e.preventDefault() }} onPointerDownOutside={e => { if (pendente) e.preventDefault() }}>
    <DialogHeader><DialogTitle>{estado.criado ? 'Usuário criado' : 'Novo usuário'}</DialogTitle><DialogDescription>Crie o acesso e entregue a senha provisória à pessoa.</DialogDescription></DialogHeader>
    {estado.aviso && <Alert role="status">{estado.aviso}</Alert>}
    {estado.criado ? <SenhaProvisoria nome={estado.criado.nome} senha={estado.criado.senhaProvisoria} concluir={fechar} /> :
      <form action={acao} aria-busy={pendente} className={styles.formulario} onSubmit={e => {
        e.preventDefault()
        if (pendente || estado.incerto) return
        const dados = new FormData(e.currentTarget)
        startTransition(() => acao(dados))
      }}>
        <label>Nome<Input name="nome" required value={nome} onChange={e => setNome(e.target.value)} disabled={pendente} /></label>
        <label>E-mail<Input name="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={pendente} /></label>
        <fieldset disabled={pendente}><legend>Papel</legend><div className={styles.acoes}>
          <label className={styles.escolha}><Choice type="radio" name="papel" value="vendedor" checked={papel === 'vendedor'} onChange={() => setPapel('vendedor')} /> Vendedor</label>
          <label className={styles.escolha}><Choice type="radio" name="papel" value="gestor" checked={papel === 'gestor'} onChange={() => setPapel('gestor')} /> Gestor</label>
        </div></fieldset>
        {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
        <DialogFooter><Button type="button" variant="outline" disabled={pendente} onClick={pedirFechamento}>Cancelar</Button><Button type="submit" disabled={pendente || estado.incerto}>{pendente ? 'Criando…' : 'Criar usuário'}</Button></DialogFooter>
      </form>}
    {confirmacao}
  </DialogContent>
}
