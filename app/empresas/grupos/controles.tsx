'use client'

import { useActionState, useState } from 'react'
import { useDescarteEdicao } from '@/src/components/crm/descarte-edicao'
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
  const inicial: EstadoGrupo = { erro: null, sucesso: false }
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoGrupo, form: FormData): Promise<EstadoGrupo> => {
    const resultado: EstadoGrupo = await alterarGrupoAcao(anterior, form).catch(() => ({ erro: RESULTADO_INCERTO, sucesso: false, incerto: true } satisfies EstadoGrupo))
    if (resultado.sucesso && !resultado.aviso) concluir()
    return resultado
  }, inicial)
  const { pedir, confirmacao } = useDescarteEdicao(!estado.sucesso && renomear && nomeEditado !== nome, pendente)
  function fechar() { pedir(concluir) }
  return <DialogContent theme={tema} showCloseButton={false}
    onEscapeKeyDown={evento => { evento.preventDefault(); fechar() }}
    onPointerDownOutside={evento => { evento.preventDefault(); fechar() }}>
    <DialogHeader>
      <DialogTitle>{renomear ? 'Renomear grupo' : `${rotulo}?`}</DialogTitle>
      <DialogDescription>{renomear ? 'Altere o nome para reconhecer esta importação.' : nome}</DialogDescription>
    </DialogHeader>
    {estado.aviso ? <>
      <Alert role="status">{estado.aviso}</Alert>
      <DialogFooter><Button type="button" onClick={concluir}>Concluir</Button></DialogFooter>
    </> : <form action={acao} className={styles.formulario}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="acao" value={renomear ? 'renomear' : ativo ? 'desativar' : 'reativar'} />
      {renomear ? <label className={styles.campo}>Nome do grupo
        <Input name="nome" required maxLength={100} value={nomeEditado} onChange={e => setNomeEditado(e.target.value)} disabled={pendente} />
      </label> : <Alert variant="warning" role="note">
        {ativo ? <><p>{impactoDesativacao} empresas disponíveis deixarão de aparecer para novas prospecções.</p><p>Esta quantidade é um retrato atual e pode mudar até a confirmação.</p></> : <p>Empresas elegíveis voltam à prospecção. Os períodos de descanso permanecem.</p>}
        <p>Carteiras e reservas atuais são preservadas. Empresas com outro grupo ativo podem continuar disponíveis.</p>
      </Alert>}
      {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
      <DialogFooter>
        <Button type="button" variant="ghost" disabled={pendente} onClick={fechar}>Cancelar</Button>
        <Button type="submit" variant={!renomear && ativo ? 'destructive' : 'default'} disabled={pendente || estado.incerto}>{pendente ? 'Salvando…' : renomear ? 'Salvar nome' : 'Confirmar'}</Button>
      </DialogFooter>
    </form>}
    {!pendente && <Button type="button" className="ui-dialog-close" variant="ghost" size="icon" aria-label="Fechar" onClick={fechar}><X aria-hidden="true" /></Button>}
    {confirmacao}
  </DialogContent>
}
