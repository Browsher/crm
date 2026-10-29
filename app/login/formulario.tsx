'use client'

import { useId, useActionState, useState } from 'react'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import styles from '@/src/components/crm/acesso.module.css'
import { Alert } from '@/src/components/ui/alert'
import { entrarAcao, type EstadoLogin } from './acao'

const inicial: EstadoLogin = { erro: null }

export function Formulario() {
  const [estado, acao, pendente] = useActionState(entrarAcao, inicial)
  const [email, setEmail] = useState('')
  const erroId = useId()
  return (
    <form action={acao} className={styles.campos} aria-busy={pendente} aria-describedby={estado.erro ? erroId : undefined}>
      <label className={styles.campo}>
        E-mail
        <Input name="email" type="email" autoComplete="username" spellCheck={false} required value={email} onChange={event => setEmail(event.target.value)} />
      </label>
      <label className={styles.campo}>
        Senha
        <Input name="senha" type="password" autoComplete="current-password" required />
      </label>
      {estado.erro && (
        <Alert id={erroId} variant="danger">
          {estado.erro}
        </Alert>
      )}
      <Button type="submit" disabled={pendente}>
        {pendente ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
