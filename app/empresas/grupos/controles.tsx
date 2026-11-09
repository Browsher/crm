'use client'

import { useActionState, useId, useLayoutEffect, useRef, useState } from 'react'
import { useDescarteEdicao } from '@/src/components/crm/descarte-edicao'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { RESULTADO_INCERTO } from '@/src/lib/edicao-administrativa'
import { Button } from '@/src/components/ui/button'
import { X } from 'lucide-react'
import { Alert } from '@/src/components/ui/alert'
import { Input } from '@/src/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { alterarGrupoAcao, type EstadoGrupo } from './acoes'
import styles from './grupos.module.css'

type Props = { id: string; nome: string; ativo: boolean; impactoDesativacao: number }
export function ControlesGrupo(props: Props) {
  return <div className={styles.acoes}>
    <Controle {...props} renomear />
    <Controle {...props} renomear={false} />
  </div>
}

function Controle(props: Props & { renomear: boolean }) {
  const [aberto, setAberto] = useState(false)
  const rotulo = props.renomear ? 'Renomear' : props.ativo ? 'Desativar grupo' : 'Reativar grupo'
  return <Dialog open={aberto} onOpenChange={valor => { if (valor) setAberto(true) }}>
    <DialogTrigger asChild><Button variant="outline">{rotulo}</Button></DialogTrigger>
    {aberto && <Formulario {...props} rotulo={rotulo} concluir={() => setAberto(false)} />}
  </Dialog>
}

function Formulario({ id, nome, ativo, impactoDesativacao, renomear, rotulo, concluir }: Props & { renomear: boolean; rotulo: string; concluir: () => void }) {
  const tema = useTemaCrm()
  const [nomeEditado, setNomeEditado] = useState(nome)
  const formularioId = useId()
  const cancelar = useRef<HTMLButtonElement>(null)
  const recibo = useRef<HTMLDivElement>(null)
  const mostrouRecibo = useRef(false)
  const inicial: EstadoGrupo = { erro: null, sucesso: false }
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoGrupo, form: FormData): Promise<EstadoGrupo> => {
    const resultado: EstadoGrupo = await alterarGrupoAcao(anterior, form).catch(() => ({ erro: RESULTADO_INCERTO, sucesso: false, incerto: true } satisfies EstadoGrupo))
    if (resultado.sucesso && !resultado.aviso) concluir()
    return resultado
  }, inicial)
  const { pedir, confirmacao } = useDescarteEdicao(!estado.sucesso && renomear && nomeEditado !== nome, pendente)
  function fechar() { pedir(concluir) }
  const aviso = estado.sucesso ? estado.aviso : undefined
  useLayoutEffect(() => {
    // A confirmação desmontada só restaura o foco quando não abriu o recibo.
    mostrouRecibo.current = !!aviso
    if (aviso && renomear) recibo.current?.focus({ preventScroll: true })
  }, [aviso, renomear])

  if (renomear || aviso) return <PainelSobrepostoCrm
    titulo={aviso ? 'Alteração concluída' : 'Renomear grupo'}
    descricao={aviso ? nome : 'Altere o nome para reconhecer esta lista.'}
    aoFechar={fechar} fecharBloqueado={pendente} ocupado={pendente}
    rodape={aviso ? <Button type="button" onClick={concluir}>Concluir</Button> : <>
      <Button type="button" variant="outline" disabled={pendente} onClick={fechar}>Cancelar</Button>
      <Button type="submit" form={formularioId} disabled={pendente || estado.incerto}>{pendente ? 'Salvando…' : 'Salvar nome'}</Button>
    </>}>
    {aviso ? <Alert ref={recibo} role="status" tabIndex={-1}>{aviso}</Alert> :
      <form id={formularioId} action={acao} className={styles.formulario} onSubmit={e => { if (pendente || estado.incerto) e.preventDefault() }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="acao" value="renomear" />
        <label className={styles.campo}>Nome do grupo
          <Input name="nome" required maxLength={100} value={nomeEditado} onChange={e => setNomeEditado(e.target.value)} disabled={pendente} />
        </label>
        {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
      </form>}
    {confirmacao}
  </PainelSobrepostoCrm>

  return <DialogContent theme={tema} showCloseButton={false}
    onOpenAutoFocus={evento => { evento.preventDefault(); cancelar.current?.focus() }}
    onCloseAutoFocus={evento => { if (mostrouRecibo.current) evento.preventDefault() }}
    onEscapeKeyDown={evento => { evento.preventDefault(); fechar() }}
    onInteractOutside={evento => { evento.preventDefault(); fechar() }}>
    <DialogHeader>
      <DialogTitle>{rotulo}?</DialogTitle>
      <DialogDescription>{nome}</DialogDescription>
    </DialogHeader>
    <form action={acao} aria-busy={pendente} className={styles.formulario} onSubmit={e => { if (pendente || estado.incerto) e.preventDefault() }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="acao" value={ativo ? 'desativar' : 'reativar'} />
      <Alert variant="warning" role="note">
        {ativo ? <>
          <p>{impactoDesativacao === 1 ? '1 empresa disponível neste grupo ficará sem grupo ativo.' : `${impactoDesativacao} empresas disponíveis neste grupo ficarão sem grupo ativo.`}</p>
          <p>Esta quantidade é um retrato atual e pode mudar até a confirmação.</p>
        </> : <p>O grupo volta a contar como origem ativa. A disponibilidade das empresas segue as regras atuais de prospecção.</p>}
        <p>O histórico e os vínculos com vendedores são preservados.</p>
      </Alert>
      {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
      <DialogFooter>
        <Button ref={cancelar} type="button" variant="ghost" disabled={pendente} onClick={fechar}>Cancelar</Button>
        <Button type="submit" variant={ativo ? 'destructive' : 'default'} disabled={pendente || estado.incerto}>{pendente ? 'Salvando…' : 'Confirmar'}</Button>
      </DialogFooter>
    </form>
    {!pendente && <Button type="button" className="ui-dialog-close" variant="ghost" size="icon" aria-label="Fechar" onClick={fechar}><X aria-hidden="true" /></Button>}
    {confirmacao}
  </DialogContent>
}
