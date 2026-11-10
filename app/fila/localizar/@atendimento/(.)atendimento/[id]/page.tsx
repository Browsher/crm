import { lerPaginaAtendimento, type PropsAtendimento } from '../../../../atendimento/conteudo'
import { PainelAtendimento } from '../../../../atendimento/painel'

export default async function AtendimentoInterceptado(props: PropsAtendimento) {
  const dados = await lerPaginaAtendimento(props)
  return <PainelAtendimento key={dados.empresa.id} {...dados} />
}
