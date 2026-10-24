export const CAMPOS_PESSOAIS = ['origem','nicho','endereco','nome','cnpj','cnae','uf','cidade','cep','disponibilidade','porte','aberturaDe','aberturaAte','pagina'] as const
export type FiltrosPessoais = Partial<Record<typeof CAMPOS_PESSOAIS[number],string>>
export type EmpresaPessoal = {id:string;nome:string;cnpj:string|null;cnae:string|null;cep:string|null;porte:string|null;abertura:string|null;bairro:string|null;cidade:string|null;uf:string|null;origens:string[];nichos:string[];regioes:string[];entrada:string;situacao:string}
export type ConsultaPessoal = {empresas:EmpresaPessoal[];total:number;nichos:string[];bairros:string[]}
export function lerFiltrosPessoais(bruto:unknown):{ok:true;filtros:FiltrosPessoais}|{ok:false} {
  if(!bruto||typeof bruto!=='object'||Array.isArray(bruto))return {ok:false}
  const filtros:FiltrosPessoais={}
  for(const [k,v] of Object.entries(bruto)) {
    if(!(CAMPOS_PESSOAIS as readonly string[]).includes(k)||typeof v!=='string'||v.length>200||/[\u0000-\u001f\u007f-\u009f]/u.test(v))return {ok:false}
    filtros[k as keyof FiltrosPessoais]=['cnpj','cnae','cep'].includes(k)?v.replace(/[.\s/-]/g,''):v.trim()
  }
  if(!['','google','banco'].includes(filtros.origem||'')||!['','disponivel','reservada_comigo','comigo','em_descanso'].includes(filtros.disponibilidade||'')||!['','MEI','ME','EPP','DEMAIS','sem'].includes(filtros.porte||''))return {ok:false}
  for(const [campo,regex] of [['cnpj',/^[0-9]{14}$/],['cnae',/^[0-9]{7}$/],['cep',/^[0-9]{8}$/],['uf',/^[A-Z]{2}$/]] as const) if(filtros[campo]&&!regex.test(filtros[campo]!))return {ok:false}
  if(filtros.pagina&&(!/^[0-9]{1,5}$/.test(filtros.pagina)||Number(filtros.pagina)<1||Number(filtros.pagina)>10000))return {ok:false}
  for(const campo of ['aberturaDe','aberturaAte'] as const) {
    const d=filtros[campo]
    if(d&&(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)||d.startsWith('0000')||Number.isNaN(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))return {ok:false}
  }
  if(filtros.aberturaDe&&filtros.aberturaAte&&filtros.aberturaDe>filtros.aberturaAte)return {ok:false}
  return {ok:true,filtros}
}
export function urlPessoal(filtros:FiltrosPessoais,pagina=1,recolhido=false) {
  const p=new URLSearchParams()
  for(const campo of CAMPOS_PESSOAIS) if(campo!=='pagina' && filtros[campo]) p.set(campo,filtros[campo]!)
  p.set('pagina',String(pagina))
  if(recolhido) p.set('pesquisado','1')
  return '/fila/localizar?'+p
}
export const SITUACOES_PESSOAIS:Record<string,string>={a_contatar:'A contatar',reservada:'Reservada para mim',atendimento:'Em atendimento',primeiro_contato:'Primeiro contato',em_negociacao:'Em negociação',proposta_enviada:'Proposta enviada',cliente:'Cliente',em_descanso:'Em descanso',indisponivel:'Indisponível'}
