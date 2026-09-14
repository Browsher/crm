'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/src/components/ui/dialog'
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
  return <Dialog open={aberto} onOpenChange={setAberto}>
    <DialogTrigger asChild><Button variant="outline">{rotulo}</Button></DialogTrigger>
    {aberto && <Formulario {...props} rotulo={rotulo} concluir={() => setAberto(false)} />}
  </Dialog>
}

function Formulario({ id, nome, ativo, impactoDesativacao, renomear, rotulo, concluir }: Props & { renomear: boolean; rotulo: string; concluir: () => void }) {
  const tema = useTemaCrm()
  const [nomeEditado, setNomeEditado] = useState(nome)
  const inicial: EstadoGrupo = { erro: null, sucesso: false }
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoGrupo, form: FormData) => {
    const resultado = await alterarGrupoAcao(anterior, form)
    if (resultado.sucesso) concluir()
    return resultado
  }, inicial)
  return <DialogContent theme={tema} showCloseButton={!pendente}
    onEscapeKeyDown={evento => { if (pendente) evento.preventDefault() }}
    onPointerDownOutside={evento => { if (pendente) evento.preventDefault() }}>
    <DialogHeader>
      <DialogTitle>{renomear ? 'Renomear grupo' : `${rotulo}?`}</DialogTitle>
      <DialogDescription>{renomear ? 'Altere o nome para reconhecer esta importação.' : nome}</DialogDescription>
    </DialogHeader>
    <form action={acao} className={styles.formulario}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="acao" value={renomear ? 'renomear' : ativo ? 'desativar' : 'reativar'} />
      {renomear ? <label className={styles.campo}>Nome do grupo
        <Input name="nome" required maxLength={100} value={nomeEditado} onChange={e => setNomeEditado(e.target.value)} disabled={pendente} />
      </label> : <div className={styles.aviso}>
        {ativo ? <><p>{impactoDesativacao} empresas disponíveis deixarão de aparecer para novas prospecções.</p><p>Esta quantidade é um retrato atual e pode mudar até a confirmação.</p></> : <p>Empresas elegíveis voltam à prospecção. Os períodos de descanso permanecem.</p>}
        <p>Carteiras e reservas atuais são preservadas. Empresas com outro grupo ativo podem continuar disponíveis.</p>
      </div>}
      {estado.erro && <p role="alert">{estado.erro}</p>}
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="ghost" disabled={pendente}>Cancelar</Button></DialogClose>
        <Button type="submit" variant={!renomear && ativo ? 'destructive' : 'default'} disabled={pendente}>{pendente ? 'Salvando…' : renomear ? 'Salvar nome' : 'Confirmar'}</Button>
      </DialogFooter>
    </form>
  </DialogContent>
}
