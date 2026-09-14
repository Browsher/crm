'use client'
import { useActionState, useEffect } from 'react'
import type { Acao, Usuario } from '@/src/features/usuarios/regras'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { agirNaLinhaAcao, type EstadoLinha } from './acoes'
import { SenhaProvisoria } from './senha'
import styles from './usuarios.module.css'

type EstadoDialogo = EstadoLinha & { concluido: boolean }
const inicial: EstadoDialogo = { erro: null, senhaProvisoria: null, concluido: false }
export const ROTULO: Record<Acao, (u: Usuario) => string> = {
  nova_senha: () => 'Nova senha provisória',
  mudar_papel: u => u.papel === 'gestor' ? 'Tornar vendedor' : 'Tornar gestor',
  desativar: () => 'Desativar', reativar: () => 'Reativar',
}
export function ConfirmarAcao({ usuario, tipo, fechar, informarPendencia, devolverFoco }: {
  usuario: Usuario; tipo: Acao; fechar: () => void; informarPendencia: (valor: boolean) => void; devolverFoco: () => void
}) {
  const [estado, acao, pendente] = useActionState(async (anterior: EstadoDialogo, form: FormData) => {
    informarPendencia(true)
    try {
      const resultado = await agirNaLinhaAcao(anterior, form)
      return { ...resultado, concluido: !resultado.erro && !resultado.senhaProvisoria }
    } finally { informarPendencia(false) }
  }, inicial)
  // A resposta e a lista revalidada precisam ser aplicadas antes de restaurar
  // o foco: o acionador pode desaparecer quando a ação muda um filtro ativo.
  useEffect(() => { if (estado.concluido) fechar() }, [estado.concluido, fechar])
  const descricao: Record<Acao, string> = {
    nova_senha: 'A senha anterior e as sessões desta pessoa serão invalidadas. Entregue a nova senha após confirmar.',
    mudar_papel: usuario.papel === 'gestor' ? 'Esta pessoa perderá o acesso à administração.' : 'Esta pessoa poderá administrar usuários e empresas.',
    desativar: 'Esta pessoa perderá o acesso ao CRM. Você poderá reativá-la depois.', reativar: 'Esta pessoa poderá voltar a acessar o CRM.',
  }
  return <DialogContent theme={useTemaCrm()} showCloseButton={!pendente}
    onCloseAutoFocus={e => { e.preventDefault(); devolverFoco() }}
    onEscapeKeyDown={e => { if (pendente) e.preventDefault() }} onPointerDownOutside={e => { if (pendente) e.preventDefault() }}>
    <DialogHeader><DialogTitle>{ROTULO[tipo](usuario)}: {usuario.nome}</DialogTitle><DialogDescription>{descricao[tipo]}</DialogDescription></DialogHeader>
    {estado.senhaProvisoria ? <SenhaProvisoria nome={usuario.nome} senha={estado.senhaProvisoria} concluir={fechar} /> :
      <form action={acao} className={styles.formulario}>
        <input type="hidden" name="id" value={usuario.id} /><input type="hidden" name="acao" value={tipo} />
        {tipo === 'mudar_papel' && <input type="hidden" name="papel" value={usuario.papel === 'gestor' ? 'vendedor' : 'gestor'} />}
        {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
        <DialogFooter><Button type="button" variant="outline" disabled={pendente} onClick={fechar}>Cancelar</Button><Button type="submit" disabled={pendente}>{pendente ? 'Confirmando…' : 'Confirmar'}</Button></DialogFooter>
      </form>}
  </DialogContent>
}
