import Link from 'next/link'
import type { ResultadoGrupoProspeccao } from '@/src/server/grupos/prospeccao'

export function ContextoGrupo({resultado,atendimento=false}: {resultado:ResultadoGrupoProspeccao|null;atendimento?:boolean}) {
  const escolher=atendimento ? '/fila?escolher_lista=1' : '/fila/localizar?escolher_lista=1'
  return <section aria-label="Lista da próxima busca" className="rounded border p-4">
    <h2 className="font-semibold">Lista da próxima busca</h2>
    {resultado?.ok ? <>
      <h3>{resultado.grupo.nome}</h3>
      {resultado.grupo.descricao && <p>{resultado.grupo.descricao}</p>}
      <p>{resultado.grupo.origem ? `Origem: ${resultado.grupo.origem}` : 'Origem não informada'}</p>
      {resultado.grupo.criterios && <p>Critérios: {resultado.grupo.criterios}</p>}
    </> : resultado ? <p role="alert">{resultado.motivo==='grupo_indisponivel' ? 'Esta lista está indisponível. Escolha outra lista ativa.' : 'Você não tem permissão para consultar esta lista.'}</p> : <p>Todas as empresas disponíveis.</p>}
    <Link href={escolher} className="text-sm underline">{resultado && !resultado.ok ? 'Todas as listas ativas' : 'Escolher outra lista'}</Link>
  </section>
}
