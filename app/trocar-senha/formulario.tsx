'use client'

import { useActionState } from 'react'
import { trocarSenhaAcao, type EstadoTroca } from './acao'

const inicial: EstadoTroca = { erro: null }

export function Formulario() {
  const [estado, acao, pendente] = useActionState(trocarSenhaAcao, inicial)
  return (
    <form action={acao} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Senha atual
        <input name="senhaAtual" type="password" autoComplete="current-password" required className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nova senha
        <input
          name="senhaNova"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="rounded border px-3 py-2"
        />
      </label>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
      <button type="submit" disabled={pendente} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pendente ? 'Trocando…' : 'Trocar senha'}
      </button>
    </form>
  )
}
