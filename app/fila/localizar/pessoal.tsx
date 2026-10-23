'use client'

import Link from 'next/link'
import { useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Badge } from '@/src/components/ui/badge'
import { UFS } from '@/src/features/busca-empresas/filtros'
import { SITUACOES_PESSOAIS, urlPessoal, type ConsultaPessoal, type FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { Reservar } from './reservar'
import { selecionarGrupo } from './navegacao'
import styles from './pessoal.module.css'

type Props={filtros:FiltrosPessoais;dados:ConsultaPessoal;recolhido:boolean;reserva?:{contexto:string|null;empresaAtual:string|null}}
export function LocalizarPessoal({filtros,dados,recolhido:inicial,reserva}:Props) {
  const router=useRouter()
  const [recolhido,setRecolhido]=useState(inicial)
  const [mais,setMais]=useState(false)
  const [pendente,iniciar]=useTransition()
  const formulario=useRef<HTMLFormElement>(null)
  function valores():FiltrosPessoais {
    return Object.fromEntries(new FormData(formulario.current!).entries()) as FiltrosPessoais
  }
  function pesquisar(e:FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const v=valores()
    setRecolhido(true)
    iniciar(()=>router.push(urlPessoal(v,1,true),{scroll:false}))
  }
  const pagina=Number(filtros.pagina||1)
  const origem=filtros.origem==='google'?'Buscas no Google':filtros.origem==='banco'?'Banco de empresas':'Google e banco de empresas'
  return <>
    {recolhido&&<div className={styles.resumo}><div><strong>Filtros da pesquisa</strong><p>{[filtros.nicho,filtros.endereco,filtros.nome,filtros.cnpj,filtros.cnae,filtros.cidade,filtros.uf].filter(Boolean).join(' · ')||'Todos os nichos e bairros'}</p></div><Button variant="outline" onClick={()=>setRecolhido(false)} aria-expanded={false} aria-controls="filtros-pessoais">Editar filtros</Button></div>}
    <form ref={formulario} id="filtros-pessoais" className={styles.filtros} hidden={recolhido} onSubmit={pesquisar}>
      <input type="hidden" name="origem" value={filtros.origem||''}/>
      <div className={styles.principais}>
        <label>Nicho<NativeSelect name="nicho" defaultValue={filtros.nicho||''} onChange={e=>{const v=valores();v.nicho=e.target.value;v.endereco='';iniciar(()=>router.push(urlPessoal(v),{scroll:false}))}}><option value="">Todos os nichos</option>{dados.nichos.map(n=><option key={n}>{n}</option>)}</NativeSelect></label>
        <label>Endereço<NativeSelect name="endereco" defaultValue={filtros.endereco||''}><option value="">Todos os bairros disponíveis</option>{dados.bairros.map(b=><option key={b}>{b}</option>)}</NativeSelect><small>Bairros com empresas no nicho escolhido.</small></label>
      </div>
      <section className={styles.mais}><h2><button type="button" aria-expanded={mais} aria-controls="mais-filtros-pessoais" onClick={()=>setMais(!mais)}><span><strong>Mais filtros</strong><small>Refine por nome, CNPJ, localização e dados cadastrais.</small></span><ChevronDown aria-hidden="true" className={mais?styles.aberto:''}/></button></h2>
        <div id="mais-filtros-pessoais" hidden={!mais} className={styles.avancados}>
          <section><h3>Identificação</h3><div className={styles.grade}>
            <label>Nome da empresa<Input name="nome" defaultValue={filtros.nome} maxLength={100} autoComplete="off" type="search" placeholder="Ex.: Armarinhos Horizonte…"/></label>
            <label>CNPJ<Input name="cnpj" defaultValue={filtros.cnpj} maxLength={18} autoComplete="off" inputMode="numeric" placeholder="Ex.: 11.222.333/0001-81…"/></label>
            <label>CNAE principal<Input name="cnae" defaultValue={filtros.cnae} maxLength={12} autoComplete="off" placeholder="Ex.: 4755-5/02…"/></label>
          </div></section>
          <section><h3>Região e CEP</h3><div className={styles.grade}>
            <label>Estado<NativeSelect name="uf" defaultValue={filtros.uf||''}><option value="">Todos</option>{UFS.map(uf=><option key={uf}>{uf}</option>)}</NativeSelect></label>
            <label>Cidade<Input name="cidade" defaultValue={filtros.cidade} maxLength={100} autoComplete="off" placeholder="Ex.: São Paulo…"/></label>
            <label>CEP<Input name="cep" defaultValue={filtros.cep} maxLength={9} inputMode="numeric" autoComplete="off" placeholder="Ex.: 03010-000…"/></label>
          </div></section>
          <section><h3>Atendimento</h3><div className={styles.grade}><label>Disponibilidade<NativeSelect name="disponibilidade" defaultValue={filtros.disponibilidade||''}><option value="">Todas</option><option value="disponivel">Disponível para prospectar</option><option value="reservada_comigo">Reservada para mim</option><option value="comigo">Sob meu atendimento</option><option value="em_descanso">Em descanso</option></NativeSelect></label></div></section>
          <section><h3>Dados cadastrais</h3><div className={styles.grade}>
            <label>Porte<NativeSelect name="porte" defaultValue={filtros.porte||''}><option value="">Todos</option><option value="MEI">MEI</option><option value="ME">Microempresa (ME)</option><option value="EPP">Pequeno porte (EPP)</option><option value="DEMAIS">Demais portes</option><option value="sem">Sem informação</option></NativeSelect></label>
            <label>Abertura a partir de<Input name="aberturaDe" defaultValue={filtros.aberturaDe} type="date" autoComplete="off"/></label>
            <label>Abertura até<Input name="aberturaAte" defaultValue={filtros.aberturaAte} type="date" autoComplete="off"/></label>
          </div></section>
        </div>
      </section>
      <div className={styles.acoes}><small>Pressione Enter para pesquisar e recolher os filtros.</small><div><Button asChild variant="outline"><Link href={urlPessoal({origem:filtros.origem})}>Limpar filtros</Link></Button><Button type="submit" disabled={pendente}>{pendente?'Pesquisando…':'Pesquisar empresas'}</Button></div></div>
    </form>
    <section aria-labelledby="minhas-empresas-titulo" aria-busy={pendente} className={styles.resultados}>
      <header className={styles.cabecalho}><div><h2 id="minhas-empresas-titulo">Todas as minhas empresas</h2><p>{origem}</p></div><p role="status">{dados.total} {dados.total===1?'empresa':'empresas'}</p></header>
      {dados.empresas.length===0?<div className={styles.vazio}>Nenhuma empresa com esses filtros. Edite os filtros ou busque novas empresas na Prospecção.</div>:<ul className={styles.cartoes}>{dados.empresas.map(e=><li key={e.id}>
        <article className={styles.empresa}><header><h3>{e.nome}</h3><Badge variant={e.situacao==='indisponivel'||e.situacao==='em_descanso'?'warning':'success'}>{SITUACOES_PESSOAIS[e.situacao]||'Em atendimento'}</Badge></header>
          <p>{e.nichos.join(' · ')}</p><p>{[e.bairro,[e.cidade,e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')||'Endereço não informado'}</p>
          <div className={styles.meta}>{e.cnpj&&<span>CNPJ {e.cnpj}</span>}{e.cnae&&<span>CNAE {e.cnae}</span>}<span>{e.origens.map(o=>o==='google'?'Google':o==='banco'?'Banco de empresas':'Cadastro existente').join(' · ')}</span></div>
          <footer><small>Recebida em {new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date(e.entrada))}</small><div>
            <Button asChild variant="outline"><Link href={`/fila/localizar/${e.id}`}>Ver empresa</Link></Button>
            {e.situacao==='a_contatar'&&reserva&&<Reservar empresaId={e.id} {...reserva} filtros={{...selecionarGrupo(null),pessoal:JSON.stringify(filtros)}}/>}
            {e.situacao==='reservada'&&<Button asChild><Link href="/fila?atendimento=1">Continuar atendimento</Link></Button>}
            {e.situacao==='cliente'&&<Button asChild><Link href={`/carteira/${e.id}`}>Abrir na carteira</Link></Button>}
            {['primeiro_contato','em_negociacao','proposta_enviada'].includes(e.situacao)&&<Button asChild><Link href="/funil">Abrir no funil</Link></Button>}
            {e.situacao==='atendimento'&&<Button asChild><Link href={`/carteira/${e.id}`}>Abrir atendimento</Link></Button>}
          </div></footer>
        </article>
      </li>)}</ul>}
      {(pagina>1||pagina*20<dados.total)&&<nav aria-label="Páginas das minhas empresas" className={styles.paginacao}>{pagina>1&&<Button asChild variant="outline"><Link href={urlPessoal(filtros,pagina-1,true)}>Página anterior</Link></Button>}<span>Página {pagina}</span>{pagina*20<dados.total&&<Button asChild variant="outline"><Link href={urlPessoal(filtros,pagina+1,true)}>Próxima página</Link></Button>}</nav>}
    </section>
  </>
}
