'use server'
import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerNegociacao, lerTelefoneNegociacao } from '@/src/features/funil/consulta'
import { registrarVenda, mudarEtapa, devolverNegociacao, type Resultado } from '@/src/features/funil/repositorio'
import { validarVenda } from '@/src/features/funil/regras'
import { proximaEtapa } from '@/src/lib/comercial'
export type EstadoFunil = {ok:boolean;erro?:string;indisponivel?:boolean}
function resultado(r:Resultado):EstadoFunil {
  if(r.ok) {
    for(const rota of ['/funil','/carteira','/meu-dia','/gestao','/usuarios']) revalidatePath(rota)
    return {ok:true}
  }
  const mensagens={sem_permissao:'A negociação não está mais disponível para você.',encerrada:'Esta negociação já foi encerrada.',dados_invalidos:'Confira os campos. A data da venda não pode ser futura.',desatualizada:'A etapa mudou. Feche e reabra a negociação.',chave_reutilizada:'Esta tentativa de venda já foi usada com outros dados. Feche e confira a Carteira.'}
  return {ok:false,erro:mensagens[r.motivo],indisponivel:r.motivo==='sem_permissao'||r.motivo==='encerrada'}
}
export async function detalheAcao(id:string) {const eu=await exigir('vendedor');return lerNegociacao(eu.usuarioId,id)}
export async function telefoneAcao(id:string) {const eu=await exigir('vendedor');return lerTelefoneNegociacao(eu.usuarioId,id)}
export async function vendaAcao(form:FormData):Promise<EstadoFunil> {
  const eu=await exigir('vendedor')
  if(form.get('confirmado')!=='sim')return {ok:false,erro:'Confirme os dados antes de registrar.'}
  const r=validarVenda({valor:String(form.get('valor')??''),data:String(form.get('data')??''),observacao:String(form.get('observacao')??''),chave:String(form.get('chave')??'')})
  if(!r.ok)return {ok:false,erro:r.erro}
  return resultado(await registrarVenda(eu.usuarioId,String(form.get('id')??''),r.dados))
}
export async function etapaAcao(form:FormData):Promise<EstadoFunil> {
  const eu=await exigir('vendedor')
  const anterior=String(form.get('anterior')??''), etapa=String(form.get('etapa')??'')
  if(proximaEtapa(anterior)!==etapa)return {ok:false,erro:'Avance somente para a próxima etapa.'}
  const r=await mudarEtapa(eu.usuarioId,String(form.get('id')??''),etapa,anterior)
  if(!r.ok&&r.motivo==='dados_invalidos')return {ok:false,erro:'Avance somente para a próxima etapa.'}
  return resultado(r)
}
export async function devolverAcao(form:FormData):Promise<EstadoFunil> {
  const eu=await exigir('vendedor')
  if(form.get('confirmado')!=='sim')return {ok:false,erro:'Confirme a devolução.'}
  return resultado(await devolverNegociacao(eu.usuarioId,String(form.get('id')??''),String(form.get('motivo')??'')))
}
