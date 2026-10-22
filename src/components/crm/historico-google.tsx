import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
export function HistoricoGoogleEmpresa({ coletas }: { coletas: { pedidoId: string; dia: string; vendedor: string; nicho: string; situacao: string }[] }) {
  if (!coletas.length) return null
  const estados: Record<string, string> = { entregue: 'Leads destinados a este vendedor', indisponivel: 'Já destinada a outro vendedor', repetida: 'Já recebida anteriormente', pendente: 'A conferir', conflito: 'Identidade em conflito' }
  return <Card><CardHeader><CardTitle><h2 className="text-base font-semibold">Histórico de coletas do Google</h2></CardTitle></CardHeader><CardContent>
    <ul className="grid list-none gap-5 p-0">{coletas.map((c, i) => <li key={`${c.pedidoId}-${i}`}>
      <strong>{c.vendedor}</strong><p>{c.nicho}, {c.dia.split('-').reverse().join('/')}</p><p>{estados[c.situacao] ?? c.situacao}</p>
      <Button asChild variant="outline"><Link href={`/empresas/google/${c.pedidoId}`}>Ver coleta</Link></Button>
    </li>)}</ul>
  </CardContent></Card>
}
