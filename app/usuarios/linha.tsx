'use client'
import { useActionState, useEffect, useLayoutEffect, useRef } from 'react'
import { RESULTADO_INCERTO } from '@/src/lib/edicao-administrativa'
import { useDescarteEdicao } from '@/src/components/crm/descarte-edicao'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import type { Acao, Usuario } from '@/src/features/usuarios/regras'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { agirNaLinhaAcao, type EstadoLinha } from './acoes'
import { SenhaProvisoria, useCopiarSenha } from './senha'
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
    } catch {
      return { ...inicial, erro: RESULTADO_INCERTO, incerto: true }
    } finally { informarPendencia(false) }
  }, inicial)
  // A resposta e a lista revalidada precisam ser aplicadas antes de restaurar
  // o foco: o acionador pode desaparecer quando a ação muda um filtro ativo.
  useEffect(() => { if (estado.concluido && !estado.aviso) fechar() }, [estado.concluido, estado.aviso, fechar])
  useDescarteEdicao(false, pendente)
  const tema = useTemaCrm()
  const cancelar = useRef<HTMLButtonElement>(null)
  const senha = estado.senhaProvisoria
  const entrega = !!senha || (estado.concluido && !!estado.aviso)
  const entregou = useRef(false)
  const { aviso: avisoCopia, copiar } = useCopiarSenha()
  // A confirmação desmontada não deve tirar o foco da lateral recém-aberta.
  useLayoutEffect(() => { entregou.current = entrega }, [entrega])

  if (entrega) return <PainelSobrepostoCrm titulo={senha ? 'Nova senha provisória' : 'Alteração concluída'}
    descricao={senha ? 'Entregue a nova senha à pessoa.' : usuario.nome}
    aoFechar={fechar} onCloseAutoFocus={e => { e.preventDefault(); devolverFoco() }}
    rodape={<>
      {senha && <Button type="button" variant="outline" onClick={() => copiar(senha)}>Copiar senha</Button>}
      <Button type="button" onClick={fechar}>Concluir</Button>
    </>}>
    {estado.aviso && <Alert role="status">{estado.aviso}</Alert>}
    {senha && <SenhaProvisoria nome={usuario.nome} senha={senha} aviso={avisoCopia} />}
  </PainelSobrepostoCrm>

  const descricao: Record<Acao, string> = {
    nova_senha: 'A senha anterior e as sessões desta pessoa serão invalidadas. Entregue a nova senha após confirmar.',
    mudar_papel: usuario.papel === 'gestor' ? 'Esta pessoa perderá o acesso à administração.' : 'Esta pessoa poderá administrar usuários e empresas.',
    desativar: 'Esta pessoa perderá o acesso ao CRM. Você poderá reativá-la depois.', reativar: 'Esta pessoa poderá voltar a acessar o CRM.',
  }
  const envioBloqueado = pendente || estado.incerto || estado.concluido
  return <DialogContent theme={tema} showCloseButton={!pendente}
    onOpenAutoFocus={e => { e.preventDefault(); cancelar.current?.focus() }}
    onCloseAutoFocus={e => { e.preventDefault(); if (!entregou.current) devolverFoco() }}
    onEscapeKeyDown={e => { if (pendente) e.preventDefault() }} onInteractOutside={e => { if (pendente) e.preventDefault() }}>
    <DialogHeader><DialogTitle>{ROTULO[tipo](usuario)}: {usuario.nome}</DialogTitle><DialogDescription>{descricao[tipo]}</DialogDescription></DialogHeader>
    <form action={acao} aria-busy={pendente} className={styles.formulario} onSubmit={e => { if (envioBloqueado) e.preventDefault() }}>
      <input type="hidden" name="id" value={usuario.id} /><input type="hidden" name="acao" value={tipo} />
      {tipo === 'mudar_papel' && <input type="hidden" name="papel" value={usuario.papel === 'gestor' ? 'vendedor' : 'gestor'} />}
      {estado.erro && <Alert variant="danger">{estado.erro}</Alert>}
      <DialogFooter><Button ref={cancelar} type="button" variant="outline" disabled={pendente} onClick={fechar}>Cancelar</Button><Button type="submit" disabled={envioBloqueado}>{pendente ? 'Confirmando…' : 'Confirmar'}</Button></DialogFooter>
    </form>
  </DialogContent>
}
