'use client'

import { useActionState } from 'react'
import type { Acao, Usuario } from '@/src/features/usuarios/regras'
import { agirNaLinhaAcao, type EstadoLinha } from './acoes'

const inicial: EstadoLinha = { erro: null, senhaProvisoria: null }

const ROTULO: Record<Acao, (u: Usuario) => string> = {
  nova_senha: () => 'Nova senha provisória',
  mudar_papel: (u) => (u.papel === 'gestor' ? 'Tornar vendedor' : 'Tornar gestor'),
  desativar: () => 'Desativar',
  reativar: () => 'Reativar',
}

// Só passa dados: quais ações mostrar já veio decidido pela página (acoesDe).
export function Linha({ usuario, acoes, souEu }: { usuario: Usuario; acoes: Acao[]; souEu: boolean }) {
  const [estado, acao, pendente] = useActionState(agirNaLinhaAcao, inicial)
  const papelNovo = usuario.papel === 'gestor' ? 'vendedor' : 'gestor'
  return (
    <li className="flex flex-col gap-2 border-b py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{usuario.nome}</span>
        {souEu && <span className="text-xs text-neutral-500">você</span>}
        <span className="text-sm text-neutral-600">{usuario.email}</span>
        <span className="text-sm">{usuario.papel}</span>
        {!usuario.ativo && <span className="text-xs text-neutral-500">inativo</span>}
        {usuario.senhaProvisoriaPendente && <span className="text-xs text-amber-700">senha provisória pendente</span>}
      </div>
      {acoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {acoes.map((a) => (
            <form key={a} action={acao}>
              <input type="hidden" name="id" value={usuario.id} />
              <input type="hidden" name="acao" value={a} />
              {a === 'mudar_papel' && <input type="hidden" name="papel" value={papelNovo} />}
              <button type="submit" disabled={pendente} className="rounded border px-2 py-1 text-xs disabled:opacity-50">
                {ROTULO[a](usuario)}
              </button>
            </form>
          ))}
        </div>
      )}
      {estado.senhaProvisoria && (
        <div className="flex flex-col gap-1 rounded border p-3">
          <code className="select-all rounded bg-neutral-100 px-3 py-2 font-mono text-lg">{estado.senhaProvisoria}</code>
          <p className="text-sm">
            Anote agora e entregue a {usuario.nome}. A senha não fica guardada; se perder, gere uma nova senha provisória.
          </p>
        </div>
      )}
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
    </li>
  )
}
