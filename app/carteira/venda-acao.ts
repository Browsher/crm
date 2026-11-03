'use server'
import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { registrarVenda } from '@/src/features/vendas/repositorio'
import { validarVenda } from '@/src/lib/venda'
import type { EstadoVenda } from '@/src/lib/venda-envio'
import { lerDestinoVenda } from '@/src/server/vendas/pos-venda'
export type { EstadoVenda } from '@/src/lib/venda-envio'
export async function vendaCarteiraAcao(form:FormData):Promise<EstadoVenda> {
  const eu=await exigir('vendedor')
  if(form.get('confirmado')!=='sim')return {ok:false,erro:'Confirme os dados antes de registrar.'}
  const validado=validarVenda({valor:String(form.get('valor')??''),data:String(form.get('data')??''),observacao:String(form.get('observacao')??''),chave:String(form.get('chave')??'')})
  if(!validado.ok)return {ok:false,erro:validado.erro,erroDeCampos:true}
  const id=String(form.get('id')??'')
  const r=await registrarVenda(eu.usuarioId,id,validado.dados)
  if(!r.ok){
    const mensagens={arquivada:'Retome o atendimento deste cliente antes de registrar uma nova venda.',desatualizada:'O atendimento mudou ou está indisponível. Atualize a página e confira o histórico antes de tentar novamente.',sem_permissao:'Este cliente não está mais disponível para você.',nao_cliente:'Registre a primeira venda pelo Funil.',dados_invalidos:'Confira os campos. A data da venda não pode ser futura.',chave_reutilizada:'Esta tentativa já foi usada com outros dados. Confira o histórico antes de iniciar outra venda.'}
    return {ok:false,erro:mensagens[r.motivo],recusaConclusiva:['arquivada','desatualizada'].includes(r.motivo),erroDeCampos:r.motivo==='dados_invalidos'}
  }
  let leituraDestino:Extract<EstadoVenda,{ok:true}>['leituraDestino']={ok:false,motivo:'leitura_indisponivel'}
  try{leituraDestino=await lerDestinoVenda(eu.usuarioId,validado.dados.chave,{tipo:'recompra'})}catch{/* Sucesso não depende da leitura posterior. */}
  let aviso:string|undefined
  try{for(const rota of ['/carteira',`/carteira/${id}`,'/meu-dia',`/empresas/${id}`,'/gestao'])revalidatePath(rota)}catch{aviso='Venda registrada. Atualize a página para conferir os dados.'}
  return {ok:true,leituraDestino,aviso}
}
