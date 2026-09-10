import { FormularioContato } from '@/src/features/contato/formulario'
import type { Contato } from '@/src/features/contato/historico'
import { LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import type { EmpresaComigo } from '@/src/features/fila/consulta'

// `agora` entra por parâmetro em vez de a função chamar new Date() dentro: é o
// que torna o render testável sem congelar o relógio do processo.
function minutosRestantes(ate: Date, agora: Date): number {
  return Math.max(0, Math.round((ate.getTime() - agora.getTime()) / 60000))
}

// Os três estados de endereço da fatia empresas, ditos com palavras
// diferentes. "Sem endereço" e "CEP que a base de julho/2024 não conhece" são
// coisas distintas, e confundi-las faz o vendedor achar que o cadastro está
// vazio quando o problema é a idade da base.
function endereco(empresa: EmpresaComigo): string {
  if (empresa.endereco) {
    const e = empresa.endereco
    return [e.logradouro, e.bairro, `${e.localidade} — ${e.uf}`].filter(Boolean).join(', ')
  }
  if (empresa.cep) return `CEP ${empresa.cep} — endereço não encontrado na base de CEP`
  return 'Empresa sem CEP cadastrado'
}

type Props = { empresa: EmpresaComigo; agora: Date; contatos: Contato[] }

export function Cartao({ empresa, agora, contatos }: Props) {
  return (
    <article className="flex flex-col gap-3 rounded border p-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{empresa.razaoSocial}</h2>
        {empresa.nomeFantasia ? <p className="text-sm text-neutral-600">{empresa.nomeFantasia}</p> : null}
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-neutral-600">Telefone</dt>
        <dd className="font-medium">{empresa.telefone}</dd>
        {empresa.contatoNome ? (
          <>
            <dt className="text-neutral-600">Contato</dt>
            <dd>{empresa.contatoNome}</dd>
          </>
        ) : null}
        {empresa.email ? (
          <>
            <dt className="text-neutral-600">E-mail</dt>
            <dd>{empresa.email}</dd>
          </>
        ) : null}
        <dt className="text-neutral-600">Endereço</dt>
        <dd>{endereco(empresa)}</dd>
        <dt className="text-neutral-600">CNPJ</dt>
        <dd>{empresa.cnpj}</dd>
      </dl>
      {empresa.reservadoAte && !empresa.posse ? (
        <p className="text-sm text-amber-700">
          Reservada para você por mais {minutosRestantes(empresa.reservadoAte, agora)} minutos. Assuma antes de a
          conversa esticar.
        </p>
      ) : null}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">O que já aconteceu com esta empresa</h3>
        <LinhaDoTempo contatos={contatos} />
      </section>
      <FormularioContato empresaId={empresa.id} posse={empresa.posse} />
    </article>
  )
}
