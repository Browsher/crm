import Link from 'next/link'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { urlPessoal } from '@/src/lib/prospeccao-pessoal'
import { Formulario } from '../../formulario'
import { lerPaginaAtendimento, type PropsAtendimento } from '../conteudo'

export default async function PaginaAtendimento(props: PropsAtendimento) {
  const dados = await lerPaginaAtendimento(props)
  const { empresa, filtros } = dados
  return <main className="grid gap-6"><CabecalhoPagina titulo={empresa.nome} descricao="Atendimento da empresa selecionada." acoes={<Button asChild variant="outline"><Link href={urlPessoal(filtros, Number(filtros.pagina || 1), true)}>Voltar para minhas empresas</Link></Button>} /><Formulario {...dados} /></main>
}
