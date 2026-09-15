'use server'
import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { registrarVenda } from '@/src/features/vendas/repositorio'
import { validarVenda } from '@/src/lib/venda'
export type EstadoVenda = {ok:boolean;erro?:string}
export async function vendaCarteiraAcao(form:FormData):Promise<EstadoVenda> {
  const eu=await exigir('vendedor')
  if(form.get('confirmado')!=='sim')return {ok:false,erro:'Confirme os dados antes de registrar.'}
  const validado=validarVenda({valor:String(form.get('valor')??''),data:String(form.get('data')??''),observacao:String(form.get('observacao')??''),chave:String(form.get('chave')??'')})
  if(!validado.ok)return {ok:false,erro:validado.erro}
  const id=String(form.get('id')??'')
  const r=await registrarVenda(eu.usuarioId,id,validado.dados)
  if(!r.ok){
    const mensagens={sem_permissao:'Este cliente não está mais disponível para você.',nao_cliente:'Registre a primeira venda pelo Funil.',dados_invalidos:'Confira os campos. A data da venda não pode ser futura.',chave_reutilizada:'Esta tentativa já foi usada com outros dados. Confira o histórico antes de iniciar outra venda.'}
    return {ok:false,erro:mensagens[r.motivo]}
  }
  for(const rota of ['/carteira',`/carteira/${id}`,'/meu-dia',`/empresas/${id}`,'/gestao'])revalidatePath(rota)
  return {ok:true}
}
