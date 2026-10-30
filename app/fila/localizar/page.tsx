import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerEmpresasPessoais } from '@/src/server/prospeccao-pessoal'
import { CAMPOS_PESSOAIS, lerFiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { Button } from '@/src/components/ui/button'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { LocalizarPessoal } from './pessoal'
import styles from '../central.module.css'

export default async function PaginaLocalizar({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const eu=await exigir('vendedor')
  const params=await searchParams
  let entrada:unknown=Object.fromEntries(CAMPOS_PESSOAIS.filter(k=>params[k]!==undefined).map(k=>[k,params[k]]))
  if(params.pessoal!==undefined) {
    try {
      entrada=typeof params.pessoal==='string'?JSON.parse(params.pessoal):null
    } catch {entrada=null}
  }
  const lidos=lerFiltrosPessoais(entrada)
  const filtros=lidos.ok?lidos.filtros:{}
  const resultado = !lidos.ok ? {ok:false as const,motivo:'filtros_invalidos' as const} : await lerEmpresasPessoais(eu.usuarioId,filtros)
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Localizar empresas" descricao="Encontre suas empresas por nicho e bairro para continuar os atendimentos." acoes={<Button asChild variant="outline"><Link href="/fila">Voltar às opções</Link></Button>} />
    {resultado.ok?<LocalizarPessoal key={JSON.stringify(params)} filtros={filtros} dados={resultado.dados} recolhido={params.pesquisado==='1'}/>:<div role="alert"><p>{resultado.motivo==='filtros_invalidos'?'Um dos filtros é inválido. Limpe os filtros e tente novamente.':'Você não tem permissão para consultar estas empresas.'}</p><Button asChild variant="outline"><Link href="/fila/localizar">Limpar filtros</Link></Button></div>}
  </main>
}
