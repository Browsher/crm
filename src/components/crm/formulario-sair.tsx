'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Alert } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { pedirSaidaDaEdicao, sairSemNovoAviso } from './descarte-edicao'

export function FormularioSair({ className, icone, rotulo }: { className?: string; icone?: ReactNode; rotulo?: string }) {
  const enviando = useRef(false)
  const [pendente, setPendente] = useState(false)
  const [falhou, setFalhou] = useState(false)

  async function sair() {
    if (enviando.current) return
    enviando.current = true
    setPendente(true)
    setFalhou(false)
    try {
      const resposta = await fetch('/sair', { method: 'POST', redirect: 'manual' })
      if (resposta.type !== 'opaqueredirect') throw new Error('Saída não confirmada')
      sairSemNovoAviso(() => location.replace('/login'))
    } catch {
      setFalhou(true)
      setPendente(false)
      enviando.current = false
    }
  }

  return <form className={className} action="/sair" method="post" aria-busy={pendente} onSubmit={e => {
    e.preventDefault()
    pedirSaidaDaEdicao(() => { void sair() })
  }}>
    <Button type="submit" variant="ghost" title={pendente ? 'Saindo…' : 'Sair'} disabled={pendente}>
      {icone}<span className={rotulo}>{pendente ? 'Saindo…' : 'Sair'}</span>
    </Button>
    {falhou && <Alert variant="danger">Não foi possível confirmar a saída. Se necessário, selecione Sair novamente.</Alert>}
  </form>
}
