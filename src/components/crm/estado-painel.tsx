import { CircleAlert, CircleCheck, CircleHelp, Clock3, Inbox, LoaderCircle, ShieldAlert } from 'lucide-react'
import styles from './painel-comum.module.css'

type Tipo = 'carregando' | 'vazio' | 'erro' | 'indisponivel' | 'pendente' | 'incerto' | 'sucesso'
const icones = { carregando: LoaderCircle, vazio: Inbox, erro: CircleAlert, indisponivel: ShieldAlert, pendente: Clock3, incerto: CircleHelp, sucesso: CircleCheck }

export function EstadoPainelCrm({ tipo, titulo, descricao }: { tipo: Tipo; titulo: string; descricao: string }) {
  const Icone = icones[tipo]
  return <div role={tipo === 'erro' ? 'alert' : 'status'} data-tipo={tipo} className={styles.estado}>
    <Icone size={18} aria-hidden="true" />
    <div><h3>{titulo}</h3><p>{descricao}</p></div>
  </div>
}
