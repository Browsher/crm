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

  // A ordem vem do banco (`proximo_passo_data ASC NULLS LAST`), então vencido
  // já chega no topo. O que a tela acrescenta é dizer quantas ficaram no fim
  // sem nada combinado: com NULLS LAST elas sumiriam do campo de visão, e é
  // por isso que o grupo é contado e nomeado em vez de só ordenado.
  const semPasso = linhas.filter((l) => l.proximoPasso === null).length

  return (
    <>
      {semPasso > 0 ? (
        <p className="rounded border border-dashed p-3 text-sm text-neutral-600">
          {semPasso} sem próximo passo — assumidas e ainda sem nada combinado.
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {linhas.map((l) => (
          <li key={l.id} className="rounded border p-3 text-sm">
            <Link href={`/carteira/${l.id}`} className="font-medium underline">
              {l.razaoSocial}
            </Link>
            <p className="text-neutral-600">
              {l.telefone}
              {l.endereco ? ` — ${l.endereco.localidade}/${l.endereco.uf}` : ''}
            </p>
            {l.proximoPasso ? (
              <p className={l.vencido ? 'text-amber-700' : 'text-neutral-700'}>
                {l.proximoPasso} — {l.proximoPassoData}
                {l.vencido ? ' (vencido)' : ''}
              </p>
            ) : (
              <p className="text-neutral-500">Sem próximo passo combinado.</p>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
