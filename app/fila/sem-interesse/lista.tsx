'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CardEmpresa } from '@/src/components/crm/card-empresa'
import { EmpresaDialogo } from '@/src/components/crm/empresa-dialogo'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import type { ReferenciaEmpresa, ResumoEmpresa } from '@/src/lib/empresa-visual'
import type { FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { textoDoMotivo } from '@/src/features/contato/mensagens'
import { retomarAcao } from './acoes'
import styles from '../localizar/pessoal.module.css'

function url(filtros:FiltrosPessoais,pagina:number){const p=new URLSearchParams();if(filtros.nome)p.set('nome',filtros.nome);if(filtros.cnpj)p.set('cnpj',filtros.cnpj);p.set('pagina',String(pagina));return '/fila/sem-interesse?'+p}
export function ListaSemInteresse({empresas,total,filtros,usuarioId}:{empresas:ResumoEmpresa[];total:number;filtros:FiltrosPessoais;usuarioId:string}) {
  const storage='crm:retomar-arquivo:v1:'+usuarioId
  const [referencia,setReferencia]=useState<ReferenciaEmpresa|null>(null),[erro,setErro]=useState('')
  const [pendente,iniciar]=useTransition(),ocupado=useRef(false)
  const [anterior,setAnterior]=useState(false)
  const router=useRouter(),pagina=Number(filtros.pagina||1)
  useEffect(()=>{const recuperar=()=>setAnterior(!!sessionStorage.getItem(storage));recuperar()},[storage])
  function retomar(e:ResumoEmpresa|null){
    if(ocupado.current)return
    ocupado.current=true
    iniciar(async()=>{
      try{
        const salvo=sessionStorage.getItem(storage)
        if(salvo&&e){setErro('Confirme a retomada anterior antes de retomar outra empresa.');return}
        if(!salvo&&(!e||e.situacao==='indisponivel'))return
        const comando=salvo?JSON.parse(salvo):{id:e!.id,versao:e!.versao,chave:crypto.randomUUID()}
        sessionStorage.setItem(storage,JSON.stringify(comando))
        setAnterior(true)
        const f=new FormData();f.set('id',comando.id);f.set('versao',String(comando.versao));f.set('chave',comando.chave)
        const r=await retomarAcao(f)
        if(!r.ok){
          if(r.motivo!=='sem_permissao'&&r.motivo!=='nao_encontrada'){sessionStorage.removeItem(storage);setAnterior(false)}
          setErro(textoDoMotivo(r.motivo));return
        }
        sessionStorage.removeItem(storage);setAnterior(false);setErro(r.repetida?'Envio anterior confirmado. Confira a situação atual da empresa.':'Atendimento retomado. Retornos cancelados não foram restaurados.');router.refresh()
      }catch{setErro('Não foi possível confirmar. Tente novamente para confirmar o mesmo envio.')}
      finally{ocupado.current=false}
    })
  }
  return <>
    <form action="/fila/sem-interesse" className={styles.formulario}><div className={styles.grade}><label>Nome da empresa<Input name="nome" defaultValue={filtros.nome} type="search" maxLength={200}/></label><label>CNPJ<Input name="cnpj" defaultValue={filtros.cnpj} inputMode="numeric" maxLength={18}/></label></div><div className={styles.acoes}><Button type="submit">Pesquisar empresas</Button><Button asChild variant="outline"><Link href="/fila/sem-interesse">Limpar filtros</Link></Button></div></form>
    <p role="status">{erro||total+' empresas sem interesse'}</p>
    {anterior&&<Button variant="outline" disabled={pendente} onClick={()=>retomar(null)}>Confirmar retomada anterior</Button>}
    <section aria-label="Empresas sem interesse" aria-busy={pendente}>
      {!empresas.length?<EstadoVazio titulo="Nenhuma empresa sem interesse" descricao="As empresas marcadas como Sem interesse aparecem aqui. Você pode retomar o atendimento quando precisar."/>:<ul className={styles.cartoes}>{empresas.map(e=><li key={e.id}><CardEmpresa empresa={e} aoVer={setReferencia} aoAcionar={pendente||anterior?undefined:()=>retomar(e)}/></li>)}</ul>}
      {(pagina>1||pagina*20<total)&&<nav aria-label="Páginas de Sem interesse" className={styles.paginacao}>{pagina>1&&<Button asChild variant="outline"><Link href={url(filtros,pagina-1)}>Página anterior</Link></Button>}<span>Página {pagina}</span>{pagina*20<total&&<Button asChild variant="outline"><Link href={url(filtros,pagina+1)}>Próxima página</Link></Button>}</nav>}
    </section>
    {referencia&&<EmpresaDialogo referencia={referencia} aoFechar={()=>setReferencia(null)}/>}
  </>
}
