'use client'

import { useActionState } from 'react'
import { textoDaRecusa, textoDoEndereco } from '@/src/features/empresas/mensagens'
import { importarAcao, type EstadoImportar } from './acao'

// Aqui, e não em acao.ts: arquivo com 'use server' só exporta função, senão o
// Next transforma a constante numa referência de servidor e este componente
// recebe uma função no lugar do objeto. O tipo pode vir de lá porque tipo é
// apagado na compilação. Mesmo desenho de app/usuarios/formulario-criar.tsx.
const inicial: EstadoImportar = { erro: null, relatorio: null, inseridas: null }

export function FormularioImportar() {
  const [estado, acao, pendente] = useActionState(importarAcao, inicial)
  const r = estado.relatorio

  // Terceiro estado: gravado. Só aqui a base mudou.
  if (estado.inseridas !== null) {
    return (
      <form action={acao} className="flex flex-col gap-3 rounded border p-4">
        <p className="text-sm">
          <strong>{estado.inseridas}</strong> {estado.inseridas === 1 ? 'empresa importada' : 'empresas importadas'}.
        </p>
        <input type="hidden" name="limpar" value="1" />
        <button type="submit" disabled={pendente} className="self-start rounded border px-3 py-1 text-sm">
          Importar outro arquivo
        </button>
      </form>
    )
  }

  return (
    <form action={acao} className="flex flex-col gap-4 rounded border p-4">
      <label className="flex flex-col gap-1 text-sm">
        Arquivo CSV
        <input name="arquivo" type="file" accept=".csv,text/csv" required className="text-sm" />
      </label>

      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}

      {r && (
        <div className="flex flex-col gap-2 rounded bg-neutral-50 p-3 text-sm">
          <p>
            <strong>{r.novas}</strong> novas · <strong>{r.jaCadastradas}</strong> já cadastradas ·{' '}
            <strong>{r.recusadas.length}</strong> recusadas
          </p>
          {textoDoEndereco(r) && <p>{textoDoEndereco(r)}</p>}
          {r.recusadas.length > 0 && (
            <ul className="flex flex-col gap-1 text-red-700">
              {r.recusadas.map((rec) => (
                <li key={`${rec.linha}-${rec.tipo}`}>{textoDaRecusa(rec)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pendente} className="rounded border px-3 py-2 text-sm">
          {pendente ? 'Conferindo…' : 'Conferir'}
        </button>
        {r && r.novas > 0 && (
          // O mesmo <input type="file"> segue no formulário, então este botão
          // reenvia o mesmo arquivo. É por isso que a página é uma só, em dois
          // estados — navegar para longe perde o arquivo escolhido.
          <button
            type="submit"
            name="confirmar"
            value="1"
            disabled={pendente}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {pendente ? 'Gravando…' : `Importar ${r.novas}`}
          </button>
        )}
      </div>
    </form>
  )
}
