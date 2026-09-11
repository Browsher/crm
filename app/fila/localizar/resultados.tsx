import type { ResumoEmpresa } from '@/src/features/prospeccao/tipos'
import { mensagemDisponibilidade } from '@/src/features/prospeccao/mensagens'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { Reservar } from './reservar'
import Link from 'next/link'
import { urlConsulta } from './navegacao'

export function Resultados({ empresas, reserva }: { empresas: ResumoEmpresa[]; reserva?: {contexto:string|null; filtros:Filtros;empresaAtual:string|null} }) {
  if (!empresas.length) return <p role="status">Nenhuma empresa encontrada.</p>
  return (
    <ul className="flex flex-col gap-3" aria-label="Empresas encontradas">
      {empresas.map(empresa => {
        const mensagem = mensagemDisponibilidade(empresa.disponibilidade)
        return (
          <li key={empresa.id} className="flex flex-col gap-3 rounded border p-4">
            <div><h2 className="font-semibold">{empresa.razaoSocial}</h2>
              {empresa.nomeFantasia && <p className="text-sm">{empresa.nomeFantasia}</p>}
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt>Cidade e estado</dt><dd>{[empresa.cidade, empresa.uf].filter(Boolean).join(', ') || 'Não informado'}</dd></div>
              <div><dt>Bairro</dt><dd>{empresa.bairro ?? 'Não informado'}</dd></div>
              <div><dt>CNAE</dt><dd>{empresa.cnaePrincipal ?? 'Não informado'}</dd></div>
            </dl>
            <div><p className="font-medium">{mensagem.titulo}</p>
              {mensagem.detalhe && <p className="text-sm">{mensagem.detalhe}</p>}
            </div>
            {reserva && empresa.disponibilidade === 'disponivel' && <Reservar empresaId={empresa.id} {...reserva} />}
            {empresa.disponibilidade === 'reservada_comigo' && <Link href={reserva ? urlConsulta(reserva.filtros, 1).replace('/fila/localizar', '/fila') : '/fila'} className="text-sm underline">Abrir atendimento</Link>}
            {empresa.disponibilidade === 'comigo' && <Link href={`/carteira/${empresa.id}`} className="text-sm underline">Abrir na carteira</Link>}
          </li>
        )
      })}
    </ul>
  )
}
