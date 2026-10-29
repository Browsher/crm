'use client'

import { useActionState, useId, useState, type ReactNode } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import { Choice } from '@/src/components/ui/choice'
import { Input } from '@/src/components/ui/input'
import { NativeSelect } from '@/src/components/ui/native-select'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import { bancoInicial, sugerirNomeBanco, ESTADOS_BR, PORTES_BANCO, SITUACOES_BANCO, CONTATOS_BANCO, type FiltrosBanco } from '@/src/lib/banco-empresas'
import { buscarEmpresasAcao, type EstadoBusca } from './acoes'
import styles from './banco.module.css'

type Props={bloqueado:boolean;restante:number;chaveInicial:string;buscaConcluidaId?:string}
export function FormularioBusca(props:Props){return <OperacaoBusca key={props.buscaConcluidaId??'nova'} {...props}/>}
function GrupoFiltro({titulo,descricao,primeiro=false,children}:{titulo:string;descricao:string;primeiro?:boolean;children:ReactNode}) {
  const [aberto,setAberto]=useState(primeiro),id=useId()
  return <section className={styles.grupo}><h2><button type="button" aria-expanded={aberto} aria-controls={id} aria-labelledby={id+'-titulo'} aria-describedby={id+'-descricao'} onClick={()=>setAberto(!aberto)}><span><strong id={id+'-titulo'}>{titulo}</strong><small id={id+'-descricao'}>{descricao}</small></span><ChevronDown aria-hidden="true" className={aberto?styles.aberto:''}/></button></h2><div id={id} hidden={!aberto} className={styles.corpo}>{children}</div></section>
}
function Escolhas({titulo,opcoes,valor,mudar,bloqueadas=[]}:{bloqueadas?:string[];titulo:string;opcoes:readonly (readonly [string,string])[];valor:string[];mudar:(v:string[])=>void}) {
  return <fieldset className={styles.escolhas}><legend>{titulo}</legend><div>{opcoes.map(([v,t])=><label key={v}><Choice type="checkbox" checked={valor.includes(v)} disabled={bloqueadas.includes(v)} onChange={e=>mudar(e.target.checked?[...valor,v]:valor.filter(x=>x!==v))}/><span>{t}</span></label>)}</div></fieldset>
}
function ListaTexto({titulo,valor,mudar,ajuda,exemplo}:{titulo:string;valor:string[];mudar:(v:string[])=>void;ajuda?:string;exemplo:string}) {
  const [texto,setTexto]=useState(''),id=useId()
  return <div className={styles.listaTexto}><label htmlFor={id}>{titulo}</label><Input id={id} value={texto||valor.join(', ')} onChange={e=>{setTexto(e.target.value);mudar(e.target.value.split(',').map(t=>t.trim()).filter(Boolean))}} maxLength={1500} autoComplete="off" placeholder={exemplo}/>{ajuda&&<small>{ajuda}</small>}</div>
}
function ExclusaoRegime({regime,marcado,desabilitado,de,ate,mudar,deMudar,ateMudar}:{regime:'MEI'|'Simples';marcado:boolean;desabilitado:boolean;de:string;ate:string;mudar:(v:boolean)=>void;deMudar:(v:string)=>void;ateMudar:(v:string)=>void}) {
  const nome=regime==='MEI'?'MEI':'Simples Nacional'
  return <div className="grid gap-3"><label className={styles.check}><Choice type="checkbox" checked={marcado} disabled={desabilitado} onChange={e=>mudar(e.target.checked)}/>Excluir optantes do {nome}</label>
    {desabilitado&&<small>Desmarque a seleção de optantes do {nome} para usar esta exclusão.</small>}
    {marcado&&<div className={styles.grade}><label>Exclusão do {regime} a partir de<Input type="date" value={de} onChange={e=>deMudar(e.target.value)}/></label><label>Exclusão do {regime} até<Input type="date" value={ate} onChange={e=>ateMudar(e.target.value)}/></label><small>Datas opcionais para refinar o período de exclusão.</small></div>}
  </div>
}
function OperacaoBusca({bloqueado,restante,chaveInicial}:Props) {
  const [estado,acao,pendente]=useActionState(buscarEmpresasAcao,{erro:null} as EstadoBusca)
  const [chave]=useState(chaveInicial)
  const [f,setF]=useState<FiltrosBanco>(()=>({...bancoInicial(),cnaesSecundarios:[]}))
  const [modoAbertura,setModoAbertura]=useState('periodo')
  const [nome,setNome]=useState('Empresas · Brasil')
  const [quantidade,setQuantidade]=useState(String(Math.max(1,Math.min(20,restante))))
  const [pagina,setPagina]=useState('1')
  const [regioes,setRegioes]=useState<{estado:string;cidade:string;bairros:string[]}[]>([{estado:'',cidade:'',bairros:[]}])
  function mudar<K extends keyof FiltrosBanco>(campo:K,valor:FiltrosBanco[K]) {setF(v=>({...v,[campo]:valor}))}
  const completos={...f,regioes:regioes.filter(r=>r.estado||r.cidade||r.bairros.length)}
  function regiao(indice:number,campo:'estado'|'cidade'|'bairros',valor:string|string[]) {setRegioes(v=>v.map((r,i)=>i===indice?{...r,[campo]:valor,...(campo==='estado'?{cidade:'',bairros:[]}:campo==='cidade'?{bairros:[]}: {})}:r))}
  const travado=bloqueado||pendente
  return <form action={acao} className={styles.formulario}>
    <input type="hidden" name="chave" value={chave}/><input type="hidden" name="avancados" value={JSON.stringify(completos)}/>
    {estado.erro&&<Alert variant="danger">{estado.erro}</Alert>}
    <GrupoFiltro titulo="Atividade e nome" descricao="Escolha o segmento e como identificar as empresas." primeiro>
      <fieldset disabled={travado}><div className={styles.grade}>
        <ListaTexto titulo="Nome ou palavra-chave" valor={f.palavras} mudar={v=>mudar('palavras',v)} exemplo="Ex.: brinquedos, variedades…" ajuda="Palavras na razão social ou nome fantasia. Separe por vírgula."/>
        <ListaTexto titulo="CNAEs principais" valor={f.cnaes} mudar={v=>mudar('cnaes',v.map(c=>c.replace(/\D/g,'')))} exemplo="Ex.: 4763-6/01, 4755-5/02…" ajuda="Informe os códigos separados por vírgula."/>
        <ListaTexto titulo="CNAEs secundários" valor={f.cnaesSecundarios??[]} mudar={v=>mudar('cnaesSecundarios',v.map(c=>c.replace(/\D/g,'')))} exemplo="Ex.: 4742-3/00…" ajuda="Códigos de atividades secundárias, separados por vírgula."/>
        <ListaTexto titulo="Naturezas jurídicas" valor={f.naturezas} mudar={v=>mudar('naturezas',v.map(c=>c.replace(/\D/g,'')))} exemplo="Ex.: 206-2, 213-5…" ajuda="Informe os códigos separados por vírgula."/>
      </div></fieldset>
    </GrupoFiltro>
    <GrupoFiltro titulo="Localização" descricao="Escolha os estados e digite as cidades e os bairros da busca.">
      <fieldset disabled={travado}><div className={styles.tituloRegiao}><h3>Região da busca</h3><span>País: <strong>Brasil (BR)</strong></span></div><p className={styles.ajuda}>Sem cidade, busca no estado inteiro. Sem bairro, busca na cidade inteira.</p>
        {regioes.map((r,i)=><div key={i} className={styles.regiao}><div className={styles.grade}>
          <div className={styles.listaTexto}><label htmlFor={'estado-banco-'+i}>Estado{regioes.length>1?` ${i+1}`:''}</label><NativeSelect id={'estado-banco-'+i} value={r.estado} onChange={e=>regiao(i,'estado',e.target.value)}><option value="">Selecione…</option>{ESTADOS_BR.map(uf=><option key={uf}>{uf}</option>)}</NativeSelect></div>
          <label>Cidade{regioes.length>1?` ${i+1}`:''}<Input value={r.cidade} maxLength={100} autoComplete="off" placeholder="Ex.: São Paulo…" onChange={e=>regiao(i,'cidade',e.target.value)}/></label>
          <ListaTexto key={r.estado+'|'+r.cidade} titulo={regioes.length>1?`Bairros ${i+1}`:'Bairros'} valor={r.bairros} mudar={v=>regiao(i,'bairros',v)} exemplo="Ex.: Brás, Sé…" ajuda="Separe os bairros por vírgula."/>
        </div>{regioes.length>1&&<Button type="button" variant="ghost" onClick={()=>setRegioes(v=>v.filter((_,j)=>j!==i))}><X aria-hidden="true"/> Remover região {i+1}</Button>}</div>)}
        <Button type="button" variant="outline" disabled={regioes.length>=20} onClick={()=>setRegioes(v=>[...v,{estado:'',cidade:'',bairros:[]}])}><Plus aria-hidden="true"/> Adicionar outra cidade ou estado</Button>
      </fieldset>
    </GrupoFiltro>
    <GrupoFiltro titulo="Perfil da empresa" descricao="Defina porte, estabelecimento, situação cadastral e regime tributário.">
      <fieldset disabled={travado}><Escolhas titulo="Porte" bloqueadas={f.excluirMei?['MEI']:[]} opcoes={PORTES_BANCO.map(p=>[p,p] as const)} valor={f.portes} mudar={v=>mudar('portes',v as FiltrosBanco['portes'])}/><Escolhas titulo="Estabelecimento" opcoes={[[ '2','Matriz'],['1','Filial']]} valor={f.tipos} mudar={v=>mudar('tipos',v as FiltrosBanco['tipos'])}/><Escolhas titulo="Situação cadastral" opcoes={SITUACOES_BANCO.map(s=>[s,s[0].toUpperCase()+s.slice(1)] as const)} valor={f.situacoes} mudar={v=>mudar('situacoes',v as FiltrosBanco['situacoes'])}/><Escolhas titulo="Regime tributário" bloqueadas={f.excluirSimples?['Simples Nacional']:[]} opcoes={[['Simples Nacional','Optante pelo Simples Nacional']]} valor={f.regimes} mudar={v=>mudar('regimes',v as FiltrosBanco['regimes'])}/><ExclusaoRegime regime="MEI" marcado={f.excluirMei??false} desabilitado={f.portes.includes('MEI')} de={f.meiExclusaoDe??''} ate={f.meiExclusaoAte??''} mudar={marcado=>setF(v=>({...v,excluirMei:marcado,...(!marcado?{meiExclusaoDe:'',meiExclusaoAte:''}:{})}))} deMudar={v=>mudar('meiExclusaoDe',v)} ateMudar={v=>mudar('meiExclusaoAte',v)}/>
        <ExclusaoRegime regime="Simples" marcado={f.excluirSimples??false} desabilitado={f.regimes.includes('Simples Nacional')} de={f.simplesExclusaoDe??''} ate={f.simplesExclusaoAte??''} mudar={marcado=>setF(v=>({...v,excluirSimples:marcado,...(!marcado?{simplesExclusaoDe:'',simplesExclusaoAte:''}:{})}))} deMudar={v=>mudar('simplesExclusaoDe',v)} ateMudar={v=>mudar('simplesExclusaoAte',v)}/>
      </fieldset>
    </GrupoFiltro>
    <GrupoFiltro titulo="Capital e data de abertura" descricao="Defina faixas para refinar o perfil das empresas.">
      <fieldset disabled={travado}><div className={styles.grade}>
        <label>Capital mínimo (R$, sem centavos)<Input type="number" min="0" step="1" value={f.capitalMinimo} onChange={e=>mudar('capitalMinimo',e.target.value)}/></label><label>Capital máximo (R$, sem centavos)<Input type="number" min="0" step="1" value={f.capitalMaximo} onChange={e=>mudar('capitalMaximo',e.target.value)}/></label>
        <div className={styles.listaTexto}><label htmlFor="modo-abertura-banco">Filtrar abertura por</label><NativeSelect id="modo-abertura-banco" value={modoAbertura} onChange={e=>{setModoAbertura(e.target.value);setF(v=>({...v,aberturaDe:'',aberturaAte:'',aberturaUltimosDias:''}))}}><option value="periodo">Período de datas</option><option value="ultimosDias">Últimos dias</option></NativeSelect></div>
        {modoAbertura==='ultimosDias'?<div className={styles.listaTexto}><label htmlFor="ultimos-dias-banco">Abertas nos últimos dias</label><Input id="ultimos-dias-banco" type="text" inputMode="numeric" maxLength={10} autoComplete="off" aria-describedby="ultimos-dias-ajuda" value={f.aberturaUltimosDias??''} onChange={e=>mudar('aberturaUltimosDias',e.target.value)}/><small id="ultimos-dias-ajuda">Informe um número inteiro positivo de dias. Ex.: 7 ou 30.</small></div>:<><label>Abertura a partir de<Input type="date" value={f.aberturaDe} onChange={e=>mudar('aberturaDe',e.target.value)}/></label><label>Abertura até<Input type="date" value={f.aberturaAte} onChange={e=>mudar('aberturaAte',e.target.value)}/></label></>}

      </div></fieldset>
    </GrupoFiltro>
    <GrupoFiltro titulo="Contatos e qualidade" descricao="Defina os contatos necessários. Telefones e emails repetidos são evitados sempre.">
      <fieldset disabled={travado}><div className={styles.grade}><label>Contato disponível<NativeSelect value={f.contato} onChange={e=>mudar('contato',e.target.value as FiltrosBanco['contato'])}>{CONTATOS_BANCO.filter(([v])=>v!=='telefoneoucelularouemail').map(([v,t])=><option key={v} value={v}>{t}</option>)}</NativeSelect></label><ListaTexto titulo="DDDs" valor={f.ddds} mudar={v=>mudar('ddds',v)} exemplo="Ex.: 11, 21…"/></div><label className={styles.check}><Choice type="checkbox" checked={f.semEmailContabil} onChange={e=>mudar('semEmailContabil',e.target.checked)}/>Evitar emails de contabilidade</label><p className={styles.ajuda}>A consulta ignora empresas já visualizadas na conta do fornecedor. Antes da importação, o CRM verifica CNPJ, telefones e emails repetidos na base global.</p></fieldset>
    </GrupoFiltro>
    <GrupoFiltro titulo="Resultados e dados retornados" descricao="Defina quantas empresas receber e como continuar uma pesquisa.">
      <fieldset disabled={travado}><div className={styles.grade}>
        <div className={styles.nomeLista}><label htmlFor="nome-lista-banco">Nome da lista</label><div><Input id="nome-lista-banco" name="nome" maxLength={100} value={nome} onChange={e=>setNome(e.target.value)} autoComplete="off" aria-describedby="nome-lista-banco-ajuda"/><Button type="button" variant="outline" onClick={()=>setNome(sugerirNomeBanco(completos as FiltrosBanco))}>Sugerir nome</Button></div><small id="nome-lista-banco-ajuda">Padrão: Nicho · Bairro · Cidade/UF. Você pode editar.</small></div>
        <div className={styles.listaTexto}><label htmlFor="quantidade-banco">Quantidade de empresas</label><Input id="quantidade-banco" name="quantidade" type="number" min={1} max={Math.max(1,Math.min(100,restante))} value={quantidade} onChange={e=>setQuantidade(e.target.value)}/><small>De 1 a 100, dentro do seu limite diário.</small></div>
        <div className={styles.listaTexto}><label htmlFor="pagina-banco">Página de resultados</label><Input id="pagina-banco" name="pagina" type="number" min={1} max={Math.floor(1000000/Math.max(1,Number(quantidade)))+1} value={pagina} onChange={e=>setPagina(e.target.value)}/><input type="hidden" name="offset" value={(Number(pagina)-1)*Number(quantidade)}/><small>Comece em 1. Mantenha a quantidade ao avançar a página.</small></div>
      </div><label className={styles.check}><Choice type="checkbox" checked={f.socios} onChange={e=>mudar('socios',e.target.checked)}/>Incluir dados completos dos sócios</label><small>Você verá nome e função. Os demais dados ficam disponíveis ao gestor.</small></fieldset>
    </GrupoFiltro>
    <div className={styles.rodape}><div><Button type="submit" disabled={travado||!chave||(modoAbertura==='ultimosDias'&&!f.aberturaUltimosDias)}>{pendente?'Buscando empresas…':'Buscar empresas'}</Button></div></div>
    {modoAbertura==='ultimosDias'&&!f.aberturaUltimosDias&&<p role="status">Informe a quantidade de dias no cartão Capital e data de abertura para buscar.</p>}
    {pendente&&<p role="status">Aguarde a conclusão. A consulta não será repetida automaticamente.</p>}
  </form>
}
