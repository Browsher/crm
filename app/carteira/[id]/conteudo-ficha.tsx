import { lerDadosCadastrais } from '@/src/server/cnpj-biz/dados'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { lerHistorico } from '@/src/features/contato/historico'
import { lerMinhasEmpresas, clienteDaCarteira } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Ficha } from './ficha'
import { RegistrarVisita } from '../../fila/localizar/registrar-visita'
import { lerFiltrosCarteira, urlCarteira } from '../filtros'
import { voltarDoMeuDia } from '../../meu-dia/agenda'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { empresaArquivada } from '@/src/components/crm/empresa-arquivada'
import PaginaCarteira from '../page'
import { ConsultaInterceptada } from './consulta-interceptada'
import type { ReactNode } from 'react'

// `params` tipado na mão, nunca com tipo gerado pelo build (R-004): o typecheck
// do CI roda sem `next build`.
export type PropsRotaFicha = {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export async function ConteudoFicha({ params, searchParams, interceptada = false }: PropsRotaFicha & { interceptada?: boolean }) {
  const { id } = await params
  const query = await searchParams ?? {}
  const doMeuDia = query.de === 'meu-dia'
  const entradaCarteira = doMeuDia ? null : lerFiltrosCarteira(query)
  const eu = await exigir('vendedor')
  const r = await lerMinhasEmpresas(eu.usuarioId)

  function consulta(titulo: string, filhos: ReactNode) {
    if (interceptada) return <ConsultaInterceptada titulo={titulo}>{filhos}</ConsultaInterceptada>
    return <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-6 max-[520px]:p-4">{filhos}</main>
  }

  if (!r.ok) {
    return consulta('Ficha do cliente', <Alert variant="danger"><AlertDescription>{textoDoMotivo(r.motivo)}</AlertDescription></Alert>)
  }

  // Empresa fora da carteira é 404, e não "sem permissão": a existência dela
  // não é informação que o vendedor deva receber.
  const empresa = r.carteira.find((e) => e.id === id)
  if (!empresa) {
    const arquivo = await empresaArquivada(eu.usuarioId, id)
    if (!arquivo) notFound()
    return consulta('Arquivo histórico', <>
      {!interceptada && <Button asChild variant="outline"><Link href="/carteira">Voltar para a carteira</Link></Button>}
      {arquivo}
    </>)
  }

  // Filtros da Carteira inválidos bloqueiam a ficha, como antes. Filtros do
  // Meu dia inválidos não bloqueiam: a origem é conhecida (lista fechada) e o
  // voltar cai para a agenda sem filtro, um literal fixo, nunca a query.
  if (entradaCarteira && !entradaCarteira.ok) return consulta('Ficha do cliente', <>
    <Alert variant="warning"><AlertTitle>Os filtros da Carteira são inválidos</AlertTitle><AlertDescription>Abra a ficha novamente a partir de uma busca válida.</AlertDescription></Alert>
    <Button asChild variant="outline"><Link href="/carteira">Limpar filtros</Link></Button>
  </>)

  // A origem é valor de lista fechada. Para o Meu dia, a decisão de destino
  // (nunca uma URL vinda da query) mora em `voltarDoMeuDia`, testada em
  // `app/meu-dia/agenda.test.tsx`.
  let voltarPara: string
  if (doMeuDia) {
    voltarPara = voltarDoMeuDia(query)
  } else {
    // Chegou até aqui sem ter voltado no `if` acima, então `entradaCarteira.ok` é sempre `true`.
    voltarPara = entradaCarteira?.ok ? urlCarteira(entradaCarteira.filtros) : '/carteira'
  }
  const rotuloVoltar = doMeuDia ? 'Voltar para o Meu dia' : 'Voltar para a carteira'
  const [historico, cliente, cadastrais] = await Promise.all([
    lerHistorico(eu.usuarioId, id), clienteDaCarteira(eu.usuarioId, id), lerDadosCadastrais(eu.usuarioId, id),
  ])

  const fundo = cliente && !interceptada ? <PaginaCarteira searchParams={Promise.resolve(doMeuDia ? {} : query)} /> : null
  return <Ficha usuarioId={eu.usuarioId} empresa={empresa} cliente={cliente} interceptada={interceptada}
    contatos={historico.ok ? historico.contatos : []} erroHistorico={!historico.ok} voltarPara={voltarPara} rotuloVoltar={rotuloVoltar}
    cadastrais={cadastrais} fundo={fundo} vendaRegistrada={query.venda === 'registrada'}
    visita={<RegistrarVisita empresaId={empresa.id} />} />
}
