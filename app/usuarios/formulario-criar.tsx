'use client'
import { startTransition, useActionState, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useDescarteEdicao } from '@/src/components/crm/descarte-edicao'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { RESULTADO_INCERTO } from '@/src/lib/edicao-administrativa'
import { Button } from '@/src/components/ui/button'
import { Choice } from '@/src/components/ui/choice'
import { Input } from '@/src/components/ui/input'
import { Alert } from '@/src/components/ui/alert'
import { Dialog, DialogTrigger } from '@/src/components/ui/dialog'
import { criarUsuarioAcao, type EstadoCriar } from './acoes'
import { SenhaProvisoria, useCopiarSenha } from './senha'
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
  const formularioId = useId()
  const { aviso: avisoCopia, copiar } = useCopiarSenha()
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoCriar, form: FormData): Promise<EstadoCriar> => {
    return criarUsuarioAcao(anterior, form).catch(() => ({ erro: RESULTADO_INCERTO, criado: null, incerto: true }))
  }, inicial)
  const { pedir, confirmacao } = useDescarteEdicao(!estado.criado && (nome !== '' || email !== '' || papel !== 'vendedor'), pendente)
  const pedirFechamento = () => pedir(fechar)
  useLayoutEffect(() => {
    fecharEditorRef.current = pedirFechamento
    return () => { fecharEditorRef.current = null }
  })
  const criado = estado.criado
  return <PainelSobrepostoCrm titulo={criado ? 'Usuário criado' : 'Novo usuário'}
    descricao={criado ? 'Acesso criado com sucesso.' : 'Crie o acesso e entregue a senha provisória à pessoa.'}
    aoFechar={pedirFechamento} fecharBloqueado={pendente} ocupado={pendente}
    rodape={criado ? <>
      <Button type="button" variant="outline" onClick={() => copiar(criado.senhaProvisoria)}>Copiar senha</Button>
      <Button type="button" onClick={fechar}>Concluir</Button>
    </> : <>
      <Button type="button" variant="outline" disabled={pendente} onClick={pedirFechamento}>Cancelar</Button>
      <Button type="submit" form={formularioId} disabled={pendente || estado.incerto}>{pendente ? 'Criando…' : 'Criar usuário'}</Button>
    </>}>
    {estado.aviso && <Alert role="status">{estado.aviso}</Alert>}
    {criado ? <SenhaProvisoria nome={criado.nome} senha={criado.senhaProvisoria} aviso={avisoCopia} focar /> :
      <form id={formularioId} action={acao} className={styles.formulario} onSubmit={e => {
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
      </form>}
    {confirmacao}
  </PainelSobrepostoCrm>
}
