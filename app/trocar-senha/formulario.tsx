'use client'

import { useId, useActionState } from 'react'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import styles from '@/src/components/crm/acesso.module.css'
import { Alert } from '@/src/components/ui/alert'
import { trocarSenhaAcao, type EstadoTroca } from './acao'

const inicial: EstadoTroca = { erro: null }

export function Formulario() {
  const [estado, acao, pendente] = useActionState(trocarSenhaAcao, inicial)
  const erroId = useId()
  return (
    <form action={acao} className={styles.campos} aria-busy={pendente} aria-describedby={estado.erro ? erroId : undefined}>
      <label className={styles.campo}>
        Senha atual
        <Input name="senhaAtual" type="password" autoComplete="current-password" required />
      </label>
      <label className={styles.campo}>
        Nova senha
        <Input
          name="senhaNova"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </label>
      {estado.erro && (
        <Alert id={erroId} variant="danger">
          {estado.erro}
        </Alert>
      )}
      <Button type="submit" disabled={pendente}>
        {pendente ? 'Trocando…' : 'Trocar senha'}
      </Button>
    </form>
  )
}
