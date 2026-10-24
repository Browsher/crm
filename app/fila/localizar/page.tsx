import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerEmpresasPessoais } from '@/src/server/prospeccao-pessoal'
import { CAMPOS_PESSOAIS, lerFiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { Button } from '@/src/components/ui/button'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { LocalizarPessoal } from './pessoal'
import Legado from './legado'
import styles from '../central.module.css'

export default async function PaginaLocalizar({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const eu=await exigir('vendedor')
  const params=await searchParams
  if(params.grupo!==undefined || params.legado==='1' || params.escolher_lista==='1') return Legado({searchParams:Promise.resolve(params)})
  let entrada:unknown=Object.fromEntries(CAMPOS_PESSOAIS.filter(k=>params[k]!==undefined).map(k=>[k,params[k]]))
  if(params.pessoal!==undefined) {
    try {
      entrada=typeof params.pessoal==='string'?JSON.parse(params.pessoal):null
    } catch {entrada=null}
  }
  const lidos=lerFiltrosPessoais(entrada)
  const filtros=lidos.ok?lidos.filtros:{}
  const [resultado,minhas]=await Promise.all([!lidos.ok?Promise.resolve({ok:false as const,motivo:'filtros_invalidos' as const}):lerEmpresasPessoais(eu.usuarioId,filtros),lerMinhasEmpresas(eu.usuarioId)])
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Localizar empresas" descricao="Encontre suas empresas por nicho e bairro para continuar os atendimentos." acoes={<Button asChild variant="outline"><Link href="/fila">Voltar às opções</Link></Button>} />
    {resultado.ok?<LocalizarPessoal key={JSON.stringify(params)} filtros={filtros} dados={resultado.dados} recolhido={params.pesquisado==='1'} reserva={minhas.ok?{contexto:minhas.contexto,empresaAtual:minhas.reserva?.id??null}:undefined}/>:<div role="alert"><p>{resultado.motivo==='filtros_invalidos'?'Um dos filtros é inválido. Limpe os filtros e tente novamente.':'Você não tem permissão para consultar estas empresas.'}</p><Button asChild variant="outline"><Link href="/fila/localizar">Limpar filtros</Link></Button></div>}
  </main>
}
