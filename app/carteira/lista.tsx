import Link from 'next/link'
import type { EmpresaComigo } from '@/src/features/fila/consulta'

export function ListaCarteira({ linhas }: { linhas: EmpresaComigo[] }) {
  if (linhas.length === 0) {
    return (
      <p className="rounded border border-dashed p-4 text-sm text-neutral-600">
        Sua carteira está vazia.{' '}
        <Link href="/fila" className="underline">
          Puxar a próxima empresa
        </Link>
        .
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {linhas.map((l) => (
        <li key={l.id} className="rounded border p-3 text-sm">
          <p className="font-medium">{l.razaoSocial}</p>
          <p className="text-neutral-600">
            {l.telefone}
            {l.endereco ? ` — ${l.endereco.localidade}/${l.endereco.uf}` : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}
