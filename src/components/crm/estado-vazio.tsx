import Link from 'next/link'
import { Inbox, type LucideIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card'
import styles from './composicoes.module.css'

type VarianteAcao = { variante?: 'default' | 'outline' }
export type AcaoEstadoVazio = VarianteAcao & (
  | { rotulo: string; href: string; aoAcionar?: never }
  | { rotulo: string; aoAcionar: () => void; href?: never; desabilitada?: boolean }
)

type Props = {
  titulo: string
  descricao: string
  acao?: AcaoEstadoVazio
  icone?: LucideIcon
  nivelTitulo?: 2 | 3
}

export function EstadoVazio({ titulo, descricao, acao, icone: Icone = Inbox, nivelTitulo = 2 }: Props) {
  const Titulo = nivelTitulo === 3 ? 'h3' : 'h2'
  return <Card className={styles.vazio}>
    <CardHeader className={styles.vazioCabecalho}>
      <span className={styles.vazioIcone}><Icone size={22} aria-hidden="true" /></span>
      <div>
        <CardTitle className={styles.vazioTitulo}><Titulo>{titulo}</Titulo></CardTitle>
        <CardDescription className={styles.vazioDescricao}>{descricao}</CardDescription>
      </div>
    </CardHeader>
    {acao ? <CardFooter className={styles.vazioRodape}>
      {acao.href !== undefined ? <Button asChild variant={acao.variante}>
        <Link href={acao.href}>{acao.rotulo}</Link>
      </Button> : <Button type="button" variant={acao.variante} onClick={acao.aoAcionar} disabled={acao.desabilitada}>
        {acao.rotulo}
      </Button>}
    </CardFooter> : null}
  </Card>
}
