import { z } from 'zod'

export const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const
export const PORTES_BANCO=['MEI','ME','EPP','DEMAIS'] as const
export const SITUACOES_BANCO=['ativa','baixada','suspensa','inapta','nula'] as const
export const REGIMES_BANCO=['Simples Nacional','Lucro Real','Lucro Presumido','Lucro Arbitrado','Isenta','Imune','Indefinido'] as const
export const CONTATOS_BANCO=[['','Qualquer contato'],['email','Email'],['celular','Celular'],['celulareemail','Celular e email'],['telefone','Telefone fixo'],['telefoneoucelular','Telefone ou celular'],['telefoneoucelulareemail','Telefone ou celular e email'],['telefoneoucelularouemail','Telefone, celular ou email']] as const
export type SocioBanco={nome?:string|null;cnpj_cpf_socio?:string|null;funcao?:{codigo?:string|null;descricao?:string|null}|null;data_entrada_sociedade?:string|null;pais?:{codigo?:number|null;descricao?:string|null}|null;representante_legal?:{cpf?:string|null;nome?:string|null}|null;faixa_etariia?:string|null}
export type DetalhesBanco={capital_social?:string|null;natureza_juridica?:string|null;regime_tributario?:string[];atividades_secundarias?:string[];socios?:(string|SocioBanco)[]}
const texto=z.string().trim().max(100).regex(/^[^\u0000-\u001f\u007f-\u009f]*$/u)
const lista=(s:z.ZodType<string>)=>z.array(s).max(20).refine(a=>new Set(a).size===a.length)
const data=z.union([z.literal(''),z.iso.date()])
const valor=z.string().regex(/^(?:|(?:0|[1-9][0-9]{0,12})(?:\.[0-9]{1,2})?)$/)
export const schemaBanco=z.strictObject({
  versao:z.literal(1),palavras:lista(texto.min(1)),cnaes:lista(z.string().regex(/^[0-9]{7}$/)),naturezas:lista(z.string().regex(/^[0-9]{4}$/)),
  atividadeTipo:z.array(z.enum(['principal','secundaria'])).min(1).max(2),
  regioes:z.array(z.strictObject({estado:z.enum(ESTADOS_BR),cidade:texto,bairros:lista(texto.min(1))}).refine(r=>!r.bairros.length||r.cidade.length>0)).max(20),
  portes:z.array(z.enum(PORTES_BANCO)).max(4),tipos:z.array(z.enum(['1','2'])).max(2),situacoes:z.array(z.enum(SITUACOES_BANCO)).max(5),regimes:z.array(z.enum(REGIMES_BANCO)).max(7),
  capitalMinimo:valor,capitalMaximo:valor,aberturaDe:data,aberturaAte:data,contato:z.enum(['','email','celular','celulareemail','telefone','telefoneoucelular','telefoneoucelulareemail','telefoneoucelularouemail']),
  ddds:lista(z.string().regex(/^[1-9][0-9]$/)),semEmailContabil:z.boolean(),socios:z.boolean(),
}).refine(a=>!a.capitalMinimo||!a.capitalMaximo||Number(a.capitalMinimo)<=Number(a.capitalMaximo)).refine(a=>!a.aberturaDe||!a.aberturaAte||a.aberturaDe<=a.aberturaAte)
export type FiltrosBanco=z.infer<typeof schemaBanco>
export function bancoInicial():FiltrosBanco {return {versao:1,palavras:[],cnaes:[],naturezas:[],atividadeTipo:['principal'],regioes:[],portes:[],tipos:[],situacoes:['ativa'],regimes:[],capitalMinimo:'',capitalMaximo:'',aberturaDe:'',aberturaAte:'',contato:'telefoneoucelular',ddds:[],semEmailContabil:false,socios:false}}
export function lerBanco(bruto:unknown):{ok:true;filtros:FiltrosBanco}|{ok:false} {
  try {const r=schemaBanco.safeParse(typeof bruto==='string'?JSON.parse(bruto):bruto);return r.success?{ok:true,filtros:r.data}:{ok:false}} catch{return {ok:false}}
}
export function sugerirNomeBanco(f:FiltrosBanco):string {
  const regiao=f.regioes[0]
  return [f.palavras[0]||f.cnaes[0]||'Empresas',regiao?.bairros.join(', '),regiao?.cidade?`${regiao.cidade}/${regiao.estado}`:regiao?.estado||'Brasil'].filter(Boolean).join(' · ').slice(0,100)
}
