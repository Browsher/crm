'use client'

import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { useTemaCrm } from './tema'
import popup from './busca-dialogo.module.css'
import base from './busca-empresas.module.css'

export function HistoricoBuscasDialogo({ children }: { children: ReactNode }) {
  const tema = useTemaCrm()
  return <Dialog>
    <DialogTrigger asChild><Button type="button" variant="outline">Ver histórico de buscas</Button></DialogTrigger>
    <DialogContent theme={tema} className={popup.dialogo}>
      <DialogHeader className={popup.cabecalho}><DialogTitle>Histórico de buscas</DialogTitle><DialogDescription>Consulte suas pesquisas salvas, inclusive as que não retornaram empresas.</DialogDescription></DialogHeader>
      <div className={popup.corpo}><div className={base.pagina}>{children}</div></div>
    </DialogContent>
  </Dialog>
}
