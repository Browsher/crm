import Link from 'next/link'
import type { EmpresaNaLista } from '@/src/features/empresas/listagem'
import { Linha } from './linha'

export function Lista({ linhas }: { linhas: EmpresaNaLista[] }) {
  if (linhas.length === 0) {
    return (
      <p className="rounded border p-3 text-sm">
        Nenhuma empresa encontrada.{' '}
        <Link href="/empresas" className="underline">
          Ver todas
        </Link>
      </p>
    )
  }
  return (
    <ul>
      {linhas.map((empresa) => (
        <Linha key={empresa.id} empresa={empresa} />
      ))}
    </ul>
  )
}
