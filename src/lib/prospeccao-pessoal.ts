export const CAMPOS_PESSOAIS = ['origem','nicho','endereco','nome','cnpj','cnae','uf','cidade','cep','disponibilidade','porte','aberturaDe','aberturaAte','pagina'] as const
export type FiltrosPessoais = Partial<Record<typeof CAMPOS_PESSOAIS[number],string>>
export type EmpresaPessoal = {id:string;nome:string;cnpj:string|null;cnae:string|null;cep:string|null;porte:string|null;abertura:string|null;bairro:string|null;cidade:string|null;uf:string|null;origens:string[];nichos:string[];regioes:string[];entrada:string;situacao:string}
export type ConsultaPessoal = {empresas:EmpresaPessoal[];total:number;nichos:string[];bairros:string[]}
export function urlPessoal(filtros:FiltrosPessoais,pagina=1,recolhido=false) {
  const p=new URLSearchParams()
  for(const campo of CAMPOS_PESSOAIS) if(campo!=='pagina' && filtros[campo]) p.set(campo,filtros[campo]!)
  p.set('pagina',String(pagina))
  if(recolhido) p.set('pesquisado','1')
  return '/fila/localizar?'+p
}
export const SITUACOES_PESSOAIS:Record<string,string>={a_contatar:'A contatar',reservada:'Reservada para mim',atendimento:'Em atendimento',primeiro_contato:'Primeiro contato',em_negociacao:'Em negociação',proposta_enviada:'Proposta enviada',cliente:'Cliente',em_descanso:'Em descanso',indisponivel:'Indisponível'}
