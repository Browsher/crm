import type { ResumoEmpresa } from '@/src/features/prospeccao/tipos'
import { mensagemDisponibilidade } from '@/src/features/prospeccao/mensagens'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { Reservar } from './reservar'
import Link from 'next/link'
import { urlConsulta } from './navegacao'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import styles from './localizar.module.css'

export function Resultados({ empresas, reserva, filtros = reserva?.filtros, mostrarPerfil = true }: { empresas: ResumoEmpresa[]; filtros?: Filtros; mostrarPerfil?: boolean; reserva?: {contexto:string|null; filtros:Filtros;empresaAtual:string|null} }) {
  if (!empresas.length) return <p role="status">Nenhuma empresa encontrada.</p>
  return (
    <ul className="flex flex-col gap-3" aria-label="Empresas encontradas">
      {empresas.map(empresa => {
        const mensagem = mensagemDisponibilidade(empresa.disponibilidade)
        return (
          <li key={empresa.id} className={styles.itemResultado}>
          <Card className={styles.cartaoEmpresa}>
            <CardHeader><CardTitle><h2 className={styles.tituloEmpresa}>{empresa.razaoSocial}</h2></CardTitle>
              {empresa.nomeFantasia && <p className="text-sm">{empresa.nomeFantasia}</p>}
            </CardHeader>
            <CardContent className={styles.conteudoCartao}>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt>Cidade e estado</dt><dd>{[empresa.cidade, empresa.uf].filter(Boolean).join(', ') || 'Não informado'}</dd></div>
              <div><dt>Bairro</dt><dd>{empresa.bairro ?? 'Não informado'}</dd></div>
              <div><dt>CNAE</dt><dd>{empresa.cnaePrincipal ?? 'Não informado'}</dd></div>
            </dl>
            <div><Badge variant={empresa.disponibilidade === 'outro_vendedor' || empresa.disponibilidade === 'em_descanso' ? 'warning' : 'success'}>{mensagem.titulo}</Badge>
              {mensagem.detalhe && <p className="text-sm">{mensagem.detalhe}</p>}
            </div>
            </CardContent>
            <CardFooter className={styles.rodapeCartao}>
            {mostrarPerfil && <Button asChild variant="outline"><Link href={filtros ? urlConsulta(filtros, filtros.pagina).replace('/fila/localizar?', `/fila/localizar/${empresa.id}?`) : `/fila/localizar/${empresa.id}`}>Ver perfil</Link></Button>}
            {reserva && empresa.disponibilidade === 'disponivel' && <Reservar empresaId={empresa.id} {...reserva} />}
            {empresa.disponibilidade === 'reservada_comigo' && <Button asChild><Link href={reserva ? urlConsulta(reserva.filtros, 1).replace('/fila/localizar', '/fila') : '/fila'}>Abrir atendimento</Link></Button>}
            {empresa.disponibilidade === 'comigo' && <Button asChild><Link href={`/carteira/${empresa.id}`}>Abrir na carteira</Link></Button>}
            </CardFooter>
          </Card>
          </li>
        )
      })}
    </ul>
  )
}
