'use client'

import { useActionState } from 'react'
import { criarUsuarioAcao, type EstadoCriar } from './acoes'

const inicial: EstadoCriar = { erro: null, criado: null }
const campo = 'rounded border px-3 py-2'

export function FormularioCriar() {
  const [estado, acao, pendente] = useActionState(criarUsuarioAcao, inicial)

  if (estado.criado) {
    return (
      <form action={acao} className="flex flex-col gap-3 rounded border p-4">
        <p className="text-sm">
          Senha provisória de <strong>{estado.criado.nome}</strong>:
        </p>
        <code className="select-all rounded bg-neutral-100 px-3 py-2 font-mono text-lg">{estado.criado.senhaProvisoria}</code>
        <p className="text-sm">
          Anote agora e entregue a {estado.criado.nome}. A senha não fica guardada; se perder, gere uma nova senha provisória na lista.
        </p>
        <input type="hidden" name="limpar" value="1" />
        <button type="submit" disabled={pendente} className="self-start rounded border px-3 py-1 text-sm">
          Criar outro
        </button>
      </form>
    )
  }

  return (
    <form action={acao} className="flex flex-col gap-4 rounded border p-4">
      <h2 className="font-semibold">Novo usuário</h2>
      <label className="flex flex-col gap-1 text-sm">
        Nome
        <input name="nome" type="text" required className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        E-mail
        <input name="email" type="email" required className={campo} />
      </label>
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1">Papel</legend>
        <label className="flex items-center gap-1">
          <input type="radio" name="papel" value="vendedor" defaultChecked /> Vendedor
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name="papel" value="gestor" /> Gestor
        </label>
      </fieldset>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
      <button type="submit" disabled={pendente} className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pendente ? 'Criando…' : 'Criar'}
      </button>
    </form>
  )
}
