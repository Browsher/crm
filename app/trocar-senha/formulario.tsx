'use client'

import { useActionState } from 'react'
import { Input } from '@/src/components/ui/input'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import { trocarSenhaAcao, type EstadoTroca } from './acao'

const inicial: EstadoTroca = { erro: null }

export function Formulario() {
  const [estado, acao, pendente] = useActionState(trocarSenhaAcao, inicial)
  return (
    <form action={acao} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Senha atual
        <Input name="senhaAtual" type="password" autoComplete="current-password" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
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
        <Alert variant="danger">
          {estado.erro}
        </Alert>
      )}
      <Button type="submit" disabled={pendente}>
        {pendente ? 'Trocando…' : 'Trocar senha'}
      </Button>
    </form>
  )
}
