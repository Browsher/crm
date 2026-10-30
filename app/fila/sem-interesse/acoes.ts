'use server'
import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { arquivarSemInteresse, retomarAtendimento } from '@/src/server/atendimento/operacoes'
import type { ResultadoAtendimento } from '@/src/lib/atendimento'

function atualizar(r:ResultadoAtendimento) {
  if(r.ok)for(const rota of ['/fila/sem-interesse','/fila/localizar','/fila/atendimento','/funil','/meu-dia','/carteira'])revalidatePath(rota)
  return r
}
export async function retomarAcao(form:FormData):Promise<ResultadoAtendimento> {
  const eu=await exigir('vendedor')
  return atualizar(await retomarAtendimento(eu.usuarioId,{empresaId:String(form.get('id')??''),chave:String(form.get('chave')??''),versao:Number(form.get('versao'))}))
}
export async function arquivarAcao(form:FormData):Promise<ResultadoAtendimento> {
  const eu=await exigir('vendedor')
  return atualizar(await arquivarSemInteresse(eu.usuarioId,{empresaId:String(form.get('id')??''),chave:String(form.get('chave')??''),versao:Number(form.get('versao'))},null))
}
