'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'

export function CardDetalhes({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  return <Card className="gap-0 py-0">
    <CardHeader className="p-0"><h3><Button type="button" variant="ghost" className="h-auto min-h-12 w-full justify-between whitespace-normal rounded-xl px-5 py-4 text-left" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(!aberto)}>
      {titulo}<ChevronDown aria-hidden="true" className={aberto ? 'rotate-180' : ''} />
    </Button></h3></CardHeader>
    {aberto && <CardContent id={id} className="pb-5 pt-1">{children}</CardContent>}
  </Card>
}
