import type { Contato } from './historico'
import { ROTULO, ehTipo } from './tipos'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { ResumoVenda } from '@/src/components/crm/resumo-venda'

function rotulo(tipo: string): string {
  // O banco só exige não-vazio, então tipo fora da lista é possível. A tela
  // mostra o texto cru em vez de quebrar.
  return ehTipo(tipo) ? ROTULO[tipo] : tipo
}

export function LinhaDoTempo({ contatos }: { contatos: Contato[] }) {
  if (contatos.length === 0) {
    return (
      <EstadoVazio nivelTitulo={3} titulo="Nenhum contato registrado nesta empresa ainda." descricao="Os atendimentos registrados nesta empresa aparecerão aqui." />
    )
  }
  return (
    <ol className="flex flex-col gap-2">
      {contatos.map((c) => (
        <li key={c.id} className="grid gap-2 border-l-2 border-border py-2 pl-4 text-sm wrap-anywhere">
          <p className="font-medium">{c.venda ? 'Venda registrada' : c.tipo === 'nao_liguei' ? 'Atividade sem ligação: Não liguei' : rotulo(c.tipo)}</p>
          {c.venda ? <ResumoVenda venda={c.venda} /> : null}
          {c.nota ? <p className="whitespace-pre-wrap text-foreground">{c.nota}</p> : null}
          {c.proximoPasso ? (
            <p className="text-foreground">
              Próximo passo registrado: {c.proximoPasso} · {c.proximoPassoData}
            </p>
          ) : null}
          <p className="text-muted-foreground">
            {c.autor ?? 'sistema'} · {c.criadoEm.toISOString().slice(0, 10)}
          </p>
        </li>
      ))}
    </ol>
  )
}
