'use client'

import { useActionState } from 'react'
import { entrarAcao, type EstadoLogin } from './acao'

const inicial: EstadoLogin = { erro: null }

export function Formulario() {
  const [estado, acao, pendente] = useActionState(entrarAcao, inicial)
  return (
    <form action={acao} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        E-mail
        <input name="email" type="email" autoComplete="username" required className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input name="senha" type="password" autoComplete="current-password" required className="rounded border px-3 py-2" />
      </label>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
      <button type="submit" disabled={pendente} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pendente ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
