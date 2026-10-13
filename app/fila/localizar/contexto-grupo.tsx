import Link from 'next/link'
import type { ResultadoGrupoProspeccao } from '@/src/server/grupos/prospeccao'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { urlEscolhaLista } from './navegacao'

export function ContextoGrupo({resultado,filtros,atendimento=false,escolhendo=false}: {resultado:ResultadoGrupoProspeccao|null;filtros:Filtros;atendimento?:boolean;escolhendo?:boolean}) {
  const escolher=urlEscolhaLista(filtros,atendimento,!escolhendo)
  return <section aria-label="Lista da próxima busca" className="rounded border p-4">
    <h2 className="font-semibold">Lista da próxima busca</h2>
    {resultado?.ok ? <>
      <h3>{resultado.grupo.nome}</h3>
      {resultado.grupo.descricao && <p>{resultado.grupo.descricao}</p>}
      <p>{resultado.grupo.origem ? `Origem: ${resultado.grupo.origem}` : 'Origem não informada'}</p>
      {resultado.grupo.criterios && <p>Critérios: {resultado.grupo.criterios}</p>}
    </> : resultado ? <p role="alert">{resultado.motivo==='grupo_indisponivel' ? 'Esta lista está indisponível. Escolha outra lista ativa.' : 'Você não tem permissão para consultar esta lista.'}</p> : <p>Todas as empresas disponíveis.</p>}
    <Link href={escolher} className="text-sm underline">{escolhendo ? 'Fechar escolha de lista' : resultado && !resultado.ok ? 'Todas as listas ativas' : 'Escolher outra lista'}</Link>
  </section>
}
