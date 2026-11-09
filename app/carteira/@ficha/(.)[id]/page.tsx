import { ConteudoFicha, type PropsRotaFicha } from '../../[id]/conteudo-ficha'

export default function FichaInterceptada(props: PropsRotaFicha) {
  return ConteudoFicha({ ...props, interceptada: true })
}
