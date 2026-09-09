import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { FormularioImportar } from './formulario'

export default async function PaginaImportarEmpresas() {
  await exigir('gestor')
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Importar empresas</h1>
        <Link href="/" className="text-sm underline">
          Início
        </Link>
      </header>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          <a href="/modelo-empresas.xlsx" download className="underline">
            Baixe o modelo
          </a>{' '}
          e preencha uma empresa por linha.
        </li>
        <li>
          No Excel, salve com <strong>Salvar como &gt; CSV UTF-8 (delimitado por vírgulas)</strong>. A opção
          &ldquo;CSV&rdquo; comum grava em outro formato e estraga os acentos.
        </li>
        <li>Envie aqui, confira o resultado e só então confirme.</li>
      </ol>
      <FormularioImportar />
    </main>
  )
}
