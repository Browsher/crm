import { FormularioContato } from '@/src/features/contato/formulario'
import type { Contato } from '@/src/features/contato/historico'
import { LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import type { RascunhoContato } from '@/src/features/contato/rascunho'
import { Button } from '@/src/components/ui/button'
import styles from './atendimento.module.css'

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
    return [e.logradouro, e.bairro, `${e.localidade}, ${e.uf}`].filter(Boolean).join(', ')
  }
  if (empresa.cep) return `CEP ${empresa.cep}. Endereço não encontrado na base de CEP`
  return 'Empresa sem CEP cadastrado'
}

type Props = {
  empresa: EmpresaComigo
  agora: Date
  contatos: Contato[]
  rascunho?: RascunhoContato
  onDraftChange?: (rascunho: RascunhoContato) => void
  onSaved?: (empresaId: string) => void
  bloqueado?: boolean
  somenteLeitura?: boolean
  onPendingChange?: (pendente: boolean) => void
  etapa?: 'consultar' | 'registrar'
  onRegistrar?: () => void
}

export function Cartao({ empresa, agora, contatos, bloqueado = false, etapa, onRegistrar, ...formulario }: Props) {
  const expirada = !empresa.posse && (!empresa.reservadoAte || empresa.reservadoAte.getTime() <= agora.getTime())
  const formularioContato = <FormularioContato empresaId={empresa.id} posse={empresa.posse}
    bloqueado={bloqueado || expirada} visual={etapa ? 'fila' : undefined} {...formulario} />
  return (
    <article className={etapa ? styles.cartao : 'flex flex-col gap-3 rounded border p-4'}>
      <div className={etapa === 'registrar' ? styles.registro : styles.conteudo}>
        <div className={styles.conteudo}>
          <header className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{empresa.razaoSocial}</h2>
            {empresa.nomeFantasia ? <p className="text-sm text-neutral-600">{empresa.nomeFantasia}</p> : null}
          </header>
          {!expirada && <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-neutral-600">Telefone</dt>
            <dd className="font-medium">{empresa.telefone}</dd>
            {empresa.contatoNome ? <><dt className="text-neutral-600">Contato</dt><dd>{empresa.contatoNome}</dd></> : null}
            {empresa.email ? <><dt className="text-neutral-600">E-mail</dt><dd>{empresa.email}</dd></> : null}
            <dt className="text-neutral-600">Endereço</dt><dd>{endereco(empresa)}</dd>
            <dt className="text-neutral-600">CNPJ</dt><dd>{empresa.cnpj}</dd>
          </dl>}
          {expirada ? <p role="status">Reserva expirada. Suas anotações foram preservadas. Tente reservar novamente para registrar.</p> : null}
          {empresa.reservadoAte && !empresa.posse && !expirada ? (
            <p role="timer" aria-label="Tempo restante da reserva" className="text-sm text-amber-700">
              Reservada para você por mais {minutosRestantes(empresa.reservadoAte, agora)} minutos. Assuma antes de a
              conversa esticar.
            </p>
          ) : null}
          {!expirada && <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">O que já aconteceu com esta empresa</h3>
            <LinhaDoTempo contatos={contatos} />
          </section>}
          {etapa === 'consultar' && !expirada ? <Button type="button" onClick={onRegistrar}>Registrar resultado</Button> : null}
        </div>
        {etapa === 'registrar' ? <div className={styles.formulario}>{formularioContato}</div> : null}
        {etapa === undefined ? formularioContato : null}
      </div>
    </article>
  )
}
