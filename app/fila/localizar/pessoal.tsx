'use client'

import Link from 'next/link'
import { useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { PainelFiltros } from '@/src/components/crm/painel-filtros'
import { Cartao } from '../cartao'
import type { ConsultaAtendimentoPessoal } from '@/src/server/prospeccao-pessoal'
import { UFS } from '@/src/features/busca-empresas/filtros'
import { urlPessoal, type FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'


import styles from './pessoal.module.css'

type Props={filtros:FiltrosPessoais;dados:ConsultaAtendimentoPessoal;recolhido:boolean}
export function LocalizarPessoal({filtros,dados,recolhido:inicial}:Props) {
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
    <form ref={formulario} id="filtros-pessoais" className={styles.formulario} hidden={recolhido} onSubmit={pesquisar}>
      <PainelFiltros className={styles.filtros} acoes={<div className={styles.acoes}><small>Pressione Enter para pesquisar e recolher os filtros.</small><div><Button asChild variant="outline"><Link href={urlPessoal({origem:filtros.origem})}>Limpar filtros</Link></Button><Button type="submit" disabled={pendente}>{pendente?'Pesquisando…':'Pesquisar empresas'}</Button></div></div>}>
      <div className={styles.campos}>
      <input type="hidden" name="origem" value={filtros.origem||''}/>
      <div className={styles.principais}>
        <div><label htmlFor="nicho-pessoal">Nicho</label><NativeSelect id="nicho-pessoal" name="nicho" defaultValue={filtros.nicho||''} onChange={e=>{const v=valores();v.nicho=e.target.value;v.endereco='';iniciar(()=>router.push(urlPessoal(v),{scroll:false}))}}><option value="">Todos os nichos</option>{dados.nichos.map(n=><option key={n}>{n}</option>)}</NativeSelect></div>
        <div><label htmlFor="endereco-pessoal">Endereço</label><NativeSelect id="endereco-pessoal" name="endereco" aria-describedby="endereco-pessoal-ajuda" defaultValue={filtros.endereco||''}><option value="">Todos os bairros disponíveis</option>{dados.bairros.map(b=><option key={b}>{b}</option>)}</NativeSelect><small id="endereco-pessoal-ajuda">Bairros com empresas no nicho escolhido.</small></div>
      </div>
      <section className={styles.mais}><h2><button type="button" aria-expanded={mais} aria-controls="mais-filtros-pessoais" aria-labelledby="mais-filtros-titulo" aria-describedby="mais-filtros-descricao" onClick={()=>setMais(!mais)}><span><strong id="mais-filtros-titulo">Mais filtros</strong><small id="mais-filtros-descricao">Refine por nome, CNPJ, localização e dados cadastrais.</small></span><ChevronDown aria-hidden="true" className={mais?styles.aberto:''}/></button></h2>
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
          <section><h3>Atendimento</h3><div className={styles.grade}><label>Disponibilidade<NativeSelect name="disponibilidade" defaultValue={filtros.disponibilidade||''}><option value="">Todas</option><option value="disponivel">A contatar</option><option value="comigo">Em atendimento</option><option value="sem_interesse">Sem interesse</option></NativeSelect></label></div></section>
          <section><h3>Dados cadastrais</h3><div className={styles.grade}>
            <label>Porte<NativeSelect name="porte" defaultValue={filtros.porte||''}><option value="">Todos</option><option value="MEI">MEI</option><option value="ME">Microempresa (ME)</option><option value="EPP">Pequeno porte (EPP)</option><option value="DEMAIS">Demais portes</option><option value="sem">Sem informação</option></NativeSelect></label>
            <label>Abertura a partir de<Input name="aberturaDe" defaultValue={filtros.aberturaDe} type="date" autoComplete="off"/></label>
            <label>Abertura até<Input name="aberturaAte" defaultValue={filtros.aberturaAte} type="date" autoComplete="off"/></label>
          </div></section>
        </div>
      </section>
      </div></PainelFiltros>
    </form>
    <section aria-labelledby="minhas-empresas-titulo" aria-busy={pendente} className={styles.resultados}>
      <header className={styles.cabecalho}><div><h2 id="minhas-empresas-titulo">Todas as minhas empresas</h2><p>{origem}</p></div><p role="status">{dados.total} {dados.total===1?'empresa':'empresas'}</p></header>
      {dados.empresas.length===0?<EstadoVazio nivelTitulo={3} titulo="Nenhuma empresa com esses filtros" descricao="Edite os filtros ou busque novas empresas na Prospecção." acao={{rotulo:'Editar filtros',aoAcionar:()=>setRecolhido(false),variante:'outline'}}/>:<ul className={styles.cartoes}>{dados.empresas.map(e=><li key={e.id}>
        <Cartao empresa={e} filtros={filtros} />
      </li>)}</ul>}
      {(pagina>1||pagina*20<dados.total)&&<nav aria-label="Páginas das minhas empresas" className={styles.paginacao}>{pagina>1&&<Button asChild variant="outline"><Link href={urlPessoal(filtros,pagina-1,true)}>Página anterior</Link></Button>}<span>Página {pagina}</span>{pagina*20<dados.total&&<Button asChild variant="outline"><Link href={urlPessoal(filtros,pagina+1,true)}>Próxima página</Link></Button>}</nav>}
    </section>
  </>
}
