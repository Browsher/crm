'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import { entrarAcao, type EstadoLogin } from './acao'

const inicial: EstadoLogin = { erro: null }

export function Formulario() {
  const [estado, acao, pendente] = useActionState(entrarAcao, inicial)
  const [email, setEmail] = useState('')
  return (
    <form action={acao} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        E-mail
        <Input name="email" type="email" autoComplete="username" spellCheck={false} required value={email} onChange={event => setEmail(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <Input name="senha" type="password" autoComplete="current-password" required />
      </label>
      {estado.erro && (
        <Alert variant="danger">
          {estado.erro}
        </Alert>
      )}
      <Button type="submit" disabled={pendente}>
        {pendente ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
