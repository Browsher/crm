import type { Contato } from './historico'
import { ROTULO, ehTipo } from './tipos'

function rotulo(tipo: string): string {
  // O banco só exige não-vazio, então tipo fora da lista é possível. A tela
  // mostra o texto cru em vez de quebrar.
  return ehTipo(tipo) ? ROTULO[tipo] : tipo
}

export function LinhaDoTempo({ contatos }: { contatos: Contato[] }) {
  if (contatos.length === 0) {
    return (
      <p className="rounded border border-dashed p-3 text-sm text-neutral-600">
        Nenhum contato registrado nesta empresa ainda.
      </p>
    )
  }
  return (
    <ol className="flex flex-col gap-2">
      {contatos.map((c) => (
        <li key={c.id} className="rounded border p-3 text-sm">
          <p className="font-medium">{rotulo(c.tipo)}</p>
          {c.nota ? <p className="text-neutral-700">{c.nota}</p> : null}
          {c.proximoPasso ? (
            <p className="text-neutral-700">
              Próximo passo: {c.proximoPasso} — {c.proximoPassoData}
            </p>
          ) : null}
          <p className="text-neutral-500">
            {c.autor ?? 'sistema'} · {c.criadoEm.toISOString().slice(0, 10)}
          </p>
        </li>
      ))}
    </ol>
  )
}
