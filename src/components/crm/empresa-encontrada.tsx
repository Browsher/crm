'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { EmpresaEncontrada } from '@/src/features/busca-empresas/tipos'
import { formatarCnpj, telefoneEmpresa, detalhesSnapshot } from '@/src/lib/empresa-visual'
import { Card, CardContent, CardHeader } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import styles from './busca-dialogo.module.css'
import { EmpresaDetalhes } from './empresa-detalhes'

export function EmpresaEncontradaDetalhes({ empresa: e }: { empresa: EmpresaEncontrada }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  return <Card className={styles.empresa}>
    <CardHeader className="gap-3">
      <div className={styles.resumo}><div className={styles.nome}><h3>{e.nome_fantasia ?? e.razao_social}</h3>{e.nome_fantasia && <p className="text-sm text-muted-foreground">{e.razao_social}</p>}</div>
        <Badge variant="outline">{e.situacao || 'Não informado'}</Badge></div>
      <p className="text-sm text-muted-foreground">{formatarCnpj(e.cnpj)} · {[e.bairro, e.cidade, e.uf].filter(Boolean).join(' / ') || 'Não informado'}</p>
      <div className={styles.contatos}><p>{telefoneEmpresa(e.telefone)}</p><p>{e.email || 'Não informado'}</p></div>
    </CardHeader>
    <CardContent className="grid gap-4">
      <Button type="button" variant="outline" className="w-fit" aria-label={`${aberto ? 'Ver menos' : 'Ver mais'}: ${e.razao_social}`} aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(!aberto)}>
        {aberto ? 'Ver menos' : 'Ver mais'}<ChevronDown aria-hidden="true" className={aberto ? 'rotate-180' : ''} />
      </Button>
      {aberto && <div id={id}>
        <EmpresaDetalhes empresa={detalhesSnapshot(e, { tipo: 'busca', buscaId: '', cnpj: e.cnpj })} />
      </div>}
    </CardContent>
  </Card>
}
