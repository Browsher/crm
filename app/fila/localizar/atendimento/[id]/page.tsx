import type { PropsAtendimento } from '../../../atendimento/conteudo'
import { filtrosDaConsulta, urlAtendimento } from '../../navegacao'
import { RedirecionarAtendimento } from '../redirecionar'

export default async function AtendimentoDireto({ params, searchParams }: PropsAtendimento) {
  const [{ id }, consulta] = await Promise.all([params, searchParams])
  return <RedirecionarAtendimento destino={urlAtendimento(id, filtrosDaConsulta(consulta))} />
}
