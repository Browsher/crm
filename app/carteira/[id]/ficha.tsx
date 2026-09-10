import { FormularioContato } from '@/src/features/contato/formulario'
import type { Contato } from '@/src/features/contato/historico'
import { LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import type { EmpresaComigo } from '@/src/features/fila/consulta'

// Os três estados de endereço da fatia empresas, ditos com palavras
// diferentes. Molde: app/fila/cartao.tsx.
function endereco(empresa: EmpresaComigo): string {
  if (empresa.endereco) {
    const e = empresa.endereco
    return [e.logradouro, e.bairro, `${e.localidade} — ${e.uf}`].filter(Boolean).join(', ')
  }
  if (empresa.cep) return `CEP ${empresa.cep} — endereço não encontrado na base de CEP`
  return 'Empresa sem CEP cadastrado'
}

export function Ficha({ empresa, contatos }: { empresa: EmpresaComigo; contatos: Contato[] }) {
  return (
    <article className="flex flex-col gap-4">
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

      {empresa.proximoPasso ? (
        <p className={empresa.vencido ? 'text-sm text-amber-700' : 'text-sm'}>
          Próximo passo: {empresa.proximoPasso} — {empresa.proximoPassoData}
          {empresa.vencido ? ' (vencido)' : ''}
        </p>
      ) : (
        <p className="text-sm text-neutral-600">Sem próximo passo combinado.</p>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Linha do tempo</h3>
        <LinhaDoTempo contatos={contatos} />
      </section>

      {/* `comDevolver` é o que fecha o gap da fila.1: até aqui não havia
          caminho de tela para devolver empresa da carteira, e quem assumia por
          engano ficava com ela.
          `voltarPara` existe porque ESTA rota deixa de existir depois de
          devolver: a empresa sai da carteira e a ficha vira 404. */}
      <FormularioContato empresaId={empresa.id} posse={empresa.posse} comDevolver voltarPara="/carteira" />
    </article>
  )
}
